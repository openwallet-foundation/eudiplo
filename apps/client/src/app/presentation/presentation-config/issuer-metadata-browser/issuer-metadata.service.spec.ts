import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { schemaFormValidator } from '../../../utils/schema-form-validator';
import { DCQLSchema } from '../../../utils/schemas';
import { readSimpleDcql } from '../dcql-query-editor/simple-dcql';
import { IssuerMetadataService, NormalizedCredential } from './issuer-metadata.service';

describe('issuer imports for the presentation builder', () => {
  it('imports mDOC claims as DCQL paths that preserve the advertised namespace', () => {
    const service = new IssuerMetadataService(null as any, null as any);
    const credential: NormalizedCredential = {
      id: 'mdl',
      format: 'mso_mdoc',
      displayName: 'Driving licence',
      doctype: 'org.iso.18013.5.1.mDL',
      claims: [
        {
          path: ['org.iso.18013.5.1', 'family_name'],
          namespace: 'org.iso.18013.5.1',
          displayName: 'Family name',
          mandatory: false,
        },
      ],
    };
    const query = service.generateDcqlQuery([{ credential, selectedClaims: credential.claims }]);
    expect(new FormControl(query, [schemaFormValidator(DCQLSchema)]).valid).toBe(true);
    expect(readSimpleDcql(query)?.credentials[0]).toMatchObject({
      claims: [{ path: ['org.iso.18013.5.1', 'family_name'] }],
    });
  });
});
