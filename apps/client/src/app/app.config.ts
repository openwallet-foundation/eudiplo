import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  APP_INITIALIZER,
  type ApplicationConfig,
  importProvidersFrom,
  provideZoneChangeDetection,
} from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { provideRouter } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { routes } from './app.routes';
import { provideFormlyCore } from '@ngx-formly/core';
import { withFormlyMaterial } from '@ngx-formly/material';
import { ObjectTypeComponent } from './types/object.type';
import { ArrayTypeComponent } from './types/array.type';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';
import schemas from './utils/schemas.json';
import transactionDataSchemaObj from '../../../../schemas/TransactionData.schema.json';
import { authInterceptor } from './core';
import { OidcService } from './core/oidc.service';

declare let monaco: any;

const transactionDataArraySchema = {
  uri: 'https://raw.githubusercontent.com/openwallet-foundation/eudiplo/refs/heads/main/schemas/TransactionDataArray.schema.json',
  fileMatch: ['a://b/TransactionDataArray*.schema.json'],
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://raw.githubusercontent.com/openwallet-foundation/eudiplo/refs/heads/main/schemas/TransactionDataArray.schema.json',
    title: 'TransactionDataArray',
    type: 'array',
    items: transactionDataSchemaObj,
  },
};

function onMonacoLoad() {
  monaco.languages.json.jsonDefaults.diagnosticsOptions.enableSchemaRequest = true;
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    schemas: [...schemas, transactionDataArraySchema],
  });
}

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (oidcService: OidcService) => () => oidcService.initialize(),
      deps: [OidcService],
      multi: true,
    },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    importProvidersFrom(FlexLayoutModule),
    provideHttpClient(withInterceptors([authInterceptor]), withFetch()),
    provideMonacoEditor({
      baseUrl: window.location.origin + window.location.pathname + '/assets/monaco/min/vs',
      onMonacoLoad,
      //monacoRequire: (window as any).monacoRequire,
      //requireConfig: { preferScriptTags: true }
    }),
    provideFormlyCore([
      ...withFormlyMaterial(),
      {
        types: [
          //{ name: 'null', component: NullTypeComponent, wrappers: ['form-field'] },
          { name: 'array', component: ArrayTypeComponent },
          { name: 'object', component: ObjectTypeComponent },
          //{ name: 'multischema', component: MultiSchemaTypeComponent },
        ],
      },
    ]),
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline' },
    },
  ],
};
