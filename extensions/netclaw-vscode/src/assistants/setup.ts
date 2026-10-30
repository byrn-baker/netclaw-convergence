import {z} from 'zod';
export const setupSchemas={
  netclaw_setup_observe:z.object({}).strict(),
  netclaw_setup_catalog:z.object({query:z.string().max(120).optional(),kind:z.enum(['component','skill','profile','comms','channel']).optional(),harness:z.enum(['openclaw','hermes']).optional(),ids:z.array(z.string().regex(/^[a-z][a-z0-9-]{0,100}$/)).max(110).optional()}).strict(),
  netclaw_setup_draft:z.object({plan:z.record(z.string(),z.unknown())}).strict(),
  netclaw_setup_validate:z.object({planRef:z.string().regex(/^draft-[a-f0-9]{32}$/)}).strict(),
  netclaw_setup_explain:z.object({planRef:z.string().regex(/^draft-[a-f0-9]{32}$/)}).strict(),
  netclaw_setup_secret_entry:z.object({planRef:z.string().regex(/^draft-[a-f0-9]{32}$/),owner:z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),key:z.string().regex(/^[A-Z][A-Z0-9_]{0,127}$/)}).strict(),
  netclaw_setup_review:z.object({planRef:z.string().regex(/^draft-[a-f0-9]{32}$/),expectedHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
  netclaw_setup_status:z.object({runRef:z.string().regex(/^run-[a-f0-9]{32}$/).optional()}).strict(),
};
export type SetupTool=keyof typeof setupSchemas;
export function setupInput(name:string,value:unknown){
  if(!Object.hasOwn(setupSchemas,name))throw Error('not_authorized');
  const result=setupSchemas[name as SetupTool].safeParse(value);if(!result.success)throw Error('invalid_input');return result.data;
}
