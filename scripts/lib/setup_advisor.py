"""Advisory partition estimates. Never changes a plan or approves downloads."""
from setup_schema import loads,Invalid
from setup_state import guarded_read

QUESTIONS={'domains':('single','several','unknown'),'credentials':('shared','separate','unknown'),
           'production':('required','testing','unknown'),'cost':('sensitive','balanced','unknown'),
           'growth':('stable','expanding','unknown')}

def advise(plan,hardware,repository,answers=None):
    answers={} if answers is None else answers
    if not isinstance(answers,dict) or set(answers)-set(QUESTIONS) or any(v not in QUESTIONS[k] for k,v in answers.items()):raise Invalid('advisor_answers_invalid')
    policy=loads(guarded_read(repository/'config/components/advisor.json'))
    catalog=loads(guarded_read(repository/'config/components/catalog.json',16*1024*1024),16*1024*1024)
    claws=plan.get('claws',[]);components={c for claw in claws for c in claw.get('capabilities',{}).get('components',[])}
    domains={claw.get('capabilities',{}).get('trustDomain') for claw in claws}-{None,''}
    selected=[c for c in catalog['components'] if c['id'] in components]
    known=[c['estimate']['schemas'] for c in selected if type(c.get('estimate',{}).get('schemas')) is int]
    unknown=len(selected)-len(known);schemas=sum(known)
    servers={s for c in selected for s in c['servers']}
    skills={s for c in claws for s in c.get('capabilities',{}).get('skills',[])}
    memory=hardware.get('memoryBytes');local=any(c.get('provider',{}).get('kind')=='local' for c in claws)
    capacity=None if type(memory) is not int or local else max(0,(memory-policy['hostReserveBytes'])//policy['cloudClawEstimateBytes'])
    # Partition each credential domain independently. Equal component IDs in two
    # domains still require two scoped members; an unspecified domain is never
    # permission to merge separate claw credentials.
    profiles=[];remaining=set();groups={}
    for index,claw in enumerate(claws):
        domain=claw.get('capabilities',{}).get('trustDomain') or 'unresolved-claw-'+str(index+1)
        groups.setdefault(domain,set()).update(claw.get('capabilities',{}).get('components',[]))
    unpartitioned=[]
    for domain,group in groups.items():
        pending=set(group)
        for profile in sorted(catalog['memberProfiles'],key=lambda p:len(set(p['components'])&group),reverse=True):
            covered=set(profile['components'])&pending
            if covered and len(profiles)<policy['maxSuggestedMembers']:
                profiles.append({'profile':profile['id'],'components':sorted(covered),'harnesses':profile['harnesses'],'trustDomain':domain});pending-=covered
        if pending:unpartitioned.append({'trustDomain':domain,'components':sorted(pending)})
        remaining.update(pending)
    reasons=[]
    for actual,threshold,reason in [(len(domains),1,'separate-credential-domains'),(len(components),policy['focusedComponentCeiling'],'component-count'),
        (schemas,policy['focusedSchemaCeiling'],'documented-tool-schemas'),(len(servers),policy['focusedServerCeiling'],'registered-mcp-count'),(len(skills),policy['focusedSkillCeiling'],'selected-skill-count')]:
        if actual>threshold:reasons.append(reason)
    if answers.get('credentials')=='separate' and 'separate-credential-domains' not in reasons:reasons.append('separate-credential-domains')
    if answers.get('domains')=='several' and answers.get('growth')=='expanding':reasons.append('growing-tool-domains')
    if answers.get('cost')=='sensitive' and (len(servers)>policy['costSensitiveServerCeiling'] or schemas>policy['costSensitiveSchemaCeiling']):reasons.append('reduce-per-member-tool-context')
    risk=bool(reasons)
    proposed=len(profiles)+len(unpartitioned)+1 if risk else 1
    if answers.get('credentials')=='separate':proposed=max(proposed,3)
    return {'schema':1,'policy':policy['version'],'advisory':True,'answers':answers,
        'recommendation':'risk' if risk else 'focused','confidence':'unknown' if capacity is None else 'planning-estimate',
        'estimatedCloudClaws':capacity,'estimatedRequiredClaws':proposed,
        'feasibility':'unknown' if capacity is None else 'constrained' if proposed>capacity else 'estimated',
        'partitions':profiles if risk else [],'unpartitionedComponents':sorted(remaining) if risk else [],
        'unpartitionedDomains':unpartitioned if risk else [],
        'trustDomains':len(domains),'automaticChanges':False,'assumptions':[policy['basis']],
        'reasons':reasons or ['within-documented-planning-thresholds'],
        'counts':{'components':len(components),'registeredMcps':len(servers),'skills':len(skills),'documentedSchemas':schemas,'unknownSchemaComponents':unknown},
        'shapeEstimates':{'focused':{'claws':1,'registeredMcps':len(servers),'skills':len(skills),'documentedSchemas':schemas,'toolContextTokens':None},
            'risk':{'claws':max(3 if answers.get('credentials')=='separate' else 2,len(profiles)+len(unpartitioned)+1),'memberGroups':len(profiles)+len(unpartitioned),'toolContextTokens':None}},
        'limitations':['No multi-host deployment. Review each member profile, credentials and provider independently.',
                      'Schema counts do not determine serialized tool-context tokens; token estimates remain unknown until discovery.',
                      'A separate-credentials answer recommends partitioning; actual credentials/domains are never copied or inferred.',
                      'Production enforcement requires verified controls for either shape; an Advisor answer is not approval.',
                      'Hot workers consume resources concurrently. On-demand workers sleep; local management services remain available.']}
