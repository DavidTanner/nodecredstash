import { KMSClient } from '@aws-sdk/client-kms';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

export interface SecretRecord {
  name: string;
  key: string;
  version: string;
  digest?: string;
  contents: string;
  hmac: string | Uint8Array | { value: string | Uint8Array };
}

export type KMSOpts = ConstructorParameters<typeof KMSClient>[0];
export type DynamoDBOpts = ConstructorParameters<typeof DynamoDBClient>[0];

export interface Configuration {
  table?: string;
  kmsKey?: string;
  kmsOpts?: KMSOpts;
  dynamoOpts?: DynamoDBOpts;
}

export interface Opts {
  tableName?: string;
  kmsKey?: string;
}

export interface QueryOpts extends Opts {
  limit?: number;
}

export interface NameOpts extends Opts {
  name: string;
}

export interface NameAndVersionOpts extends NameOpts {
  version: string | number;
}

export interface OptContext extends Opts {
  context?: Record<string, string>;
}

export interface PutSecret extends OptContext {
  name: string;
  secret: string;
  version?: string | number;
  digest?: string;
}

export interface GetAllVersions extends OptContext, QueryOpts {
  name: string;
}

export interface GetSecret extends NameOpts, OptContext {
  version?: string | number;
}

export interface GetAllSecrets extends OptContext {
  version?: string | number;
  startsWith?: string;
}

export interface GetHighestVersionResponse {
  version: string;
  secret: string;
}
