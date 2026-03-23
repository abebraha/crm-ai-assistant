import { CRMType, CRMAdapter } from './types';
import { HubSpotAdapter }    from './hubspot';
import { SalesforceAdapter } from './salesforce';
import { PipedriveAdapter }  from './pipedrive';
import { ZohoAdapter }       from './zoho';
import { CloseAdapter }      from './close';

export function getCRMAdapter(crm: CRMType): CRMAdapter {
  switch (crm) {
    case 'hubspot':    return new HubSpotAdapter();
    case 'salesforce': return new SalesforceAdapter();
    case 'pipedrive':  return new PipedriveAdapter();
    case 'zoho':       return new ZohoAdapter();
    case 'close':      return new CloseAdapter();
    default:
      throw new Error(`Unknown CRM: ${crm}`);
  }
}