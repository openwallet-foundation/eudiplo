import { PresentationConfigCreateDto } from '@eudiplo/sdk-core';

export interface PredefinedConfig {
  name: string;
  description: string;
  icon: string;
  config: PresentationConfigCreateDto;
}

export const configs: PredefinedConfig[] = [
  {
    name: 'PID (Personal Identity Document)',
    description: 'Request the given name from a German PID',
    icon: 'badge',
    config: {
      id: 'pid',
      description: 'Request a given name from a German PID',
      dcql_query: {
        credentials: [
          {
            id: 'pid',
            format: 'dc+sd-jwt',
            meta: {
              vct_values: ['urn:eudi:pid:de:1'],
            },
            claims: [
              {
                path: ['given_name'],
              },
            ],
          },
        ],
      },
    },
  },
];
