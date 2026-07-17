import { Injectable } from '@angular/core';
import {
  type SchemaMetadataResponseDto,
  type IssuanceConfig,
  issuanceConfigControllerGetIssuanceConfigurations,
  issuanceConfigControllerReissueRegistrationCertificate,
  issuanceConfigControllerStoreIssuanceConfiguration,
  credentialOfferControllerGetOffer,
  schemaMetadataControllerFindAll,
  type OfferRequestDto,
  UpdateIssuanceDto,
} from '@eudiplo/sdk-core';

@Injectable({
  providedIn: 'root',
})
export class IssuanceConfigService {
  getConfig() {
    return issuanceConfigControllerGetIssuanceConfigurations().then((response) => response.data);
  }

  /**
   * Save or update an issuance configuration
   */
  saveConfiguration(config: UpdateIssuanceDto) {
    return issuanceConfigControllerStoreIssuanceConfiguration({ body: config }).then(
      (response) => response.data
    );
  }

  reissueRegistrationCertificate() {
    return issuanceConfigControllerReissueRegistrationCertificate().then(
      (response) => response.data as IssuanceConfig
    );
  }

  getOffer(values: OfferRequestDto) {
    return credentialOfferControllerGetOffer({ body: values }).then((response) => response.data);
  }

  getSchemaMetadata(): Promise<SchemaMetadataResponseDto[]> {
    return schemaMetadataControllerFindAll().then((response) => response.data || []);
  }
}
