"""Certificate primitives used only in the isolated component interpreter."""
import datetime
import importlib.util
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID
from setup_schema import loads
from setup_state import Conflict,guarded_read

def check_binding(binding):
    if not isinstance(binding,dict) or set(binding)!={'schema','home','runId','planHash','owner','installationId'} or binding['schema']!=1:raise Conflict('certificate_binding_invalid')
    home=Path(binding['home'])
    owner=loads(guarded_read(home/'.netclaw-setup-owner.json',16384,private=True))
    identity=loads(guarded_read(home/'netclaw-hud/installation.json',8192,private=True))
    if owner!={'schema':1,'runId':binding['runId'],'planHash':binding['planHash'],'installationId':binding['owner']} or identity.get('installationId')!=binding['installationId']:raise Conflict('certificate_owner_changed')
    return 'netclaw-'+binding['installationId']

def generate(binding):
    name=check_binding(binding)
    source=Path(__file__).resolve().parents[2]/'mcp-servers/protocol-mcp/bgp/federation/certs.py'
    spec=importlib.util.spec_from_file_location('setup_cert_primitives',source);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    certificate,key=module.create_self_signed(name)
    value={'binding':binding,'certificate':certificate,'key':key}
    validate(value,binding)
    return value

def validate(value,binding):
    name=check_binding(binding)
    if not isinstance(value,dict) or set(value)!={'binding','certificate','key'} or value['binding']!=binding or not all(isinstance(value[k],str) and len(value[k])<=16384 for k in ('certificate','key')):raise Conflict('certificate_material_invalid')
    cert=x509.load_pem_x509_certificate(value['certificate'].encode())
    key=serialization.load_pem_private_key(value['key'].encode(),password=None)
    if not isinstance(key,ec.EllipticCurvePrivateKey) or not isinstance(key.curve,ec.SECP256R1) or not isinstance(cert.public_key(),ec.EllipticCurvePublicKey) or key.public_key().public_numbers()!=cert.public_key().public_numbers():raise Conflict('certificate_key_mismatch')
    if cert.subject!=cert.issuer or cert.subject!=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,name)]):raise Conflict('certificate_identity_mismatch')
    if cert.extensions.get_extension_for_class(x509.SubjectAlternativeName).value.get_values_for_type(x509.UniformResourceIdentifier)!=['ncfed:'+name]:raise Conflict('certificate_identity_mismatch')
    now=datetime.datetime.now(datetime.timezone.utc)
    if not cert.not_valid_before_utc<=now<cert.not_valid_after_utc:raise Conflict('certificate_time_invalid')
    cert.public_key().verify(cert.signature,cert.tbs_certificate_bytes,ec.ECDSA(cert.signature_hash_algorithm))
    return True
