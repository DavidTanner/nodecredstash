import { SecretRecord } from '../../../src/types';

export interface StaticData extends SecretRecord {
  name: string;
  version: string;
  key: string;
  plainText: string;
  hmacMd5?: string;
  hmacSha256?: string;
  hmacSha512?: string;
  kms?: { Plaintext: Uint8Array; CiphertextBlob: Uint8Array };
}

export const item: StaticData = {
  name: 'quotation',
  version: '0000000000000000001',
  key: 'quotationKey',
  plainText: `"Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit..."
"There is no one who loves pain itself, who seeks after it and wants to have it, simply because it is pain..."`,
  contents: 'WfAxFvTQQaAWaLj7BgFeYc6wtpqdoaT0hLfT8gQyo2FHKEcEBETUG7f2sQpSkjZzo7660h0POrVYTG26I5xsmzbX7fJkzZ7qDbtsti/'
    + 'ucF7GUpyJTN6PQIbrfEPH7F5zYV7dUeca/awLUZJOq1qDqGYy6hCBdJqh2KnPDLc4Ewl5r00wXNQBzYf5w1JVmNLS3vfOM20wY5js3pLdcYUa/'
    + 'XdrfO8jg2JcRZbsL1dQWUDCK9SesI0CHyiMwJCMkBLq9BwiNzJZayzjIrfF65rw',
  hmacMd5: '570ae3cf8d5bf0c0b26bfea941a84bfb',
  hmac: '74feaf25b284d319aa1342ebaadca39813465895ad4f924c2e7e45a77ee0b010',
  hmacSha256: '74feaf25b284d319aa1342ebaadca39813465895ad4f924c2e7e45a77ee0b010',
  hmacSha512: '61f7bb0d82cb8dee073529fc6a5c99486ca81b1a3800dd08f569afe381ab78f7a6eb32276491b0a8c47a9d6bf9'
    + '446d731cb9a82e002b3c46349cbcba1d4bb999',
  kms: {
    get Plaintext() {
      return Buffer.from('Expenses as material breeding insisted building to in. Continual', 'utf8');
    },
    get CiphertextBlob() {
      return Buffer.from('123');
    },
  },
};

export const legacyItem: StaticData = {
  name: 'Death Star vulnerability',
  digest: 'SHA256',
  version: '0000000000000000001',
  contents: 'qIwrvluzINIiY/6M',
  key: 'NGZkZmQwZjktMDUzOC00MDUxLThjMmEtOWM4NTFhZDc3OTU3bF3jZ1Zj9+8Gv+WptFFAjtrCURVmpp/ShC3oihDXBI/i/6xc7FT7Ji4FaDFb'
    + 'tQQdmHJgvF44CIC0WhDGFcPh/ImdvYZPuzFO6eNSwMo3kaU=',
  hmac: '23071c4fb00012eccbfb8ba71197f01e5a6b2694b4ade55fcf6ebaaa2007d68b',

  plainText: 'Exhaust vent',

  hmacSha256: '',
  hmacMd5: '',
  hmacSha512: '',

  kms: {
    get Plaintext() {
      return Buffer.from('u4Jb5gRL1hPgn+XwKOz2jGxQ8L+D+cEAiZCGM67ySGA=', 'base64');
    },
    get CiphertextBlob() {
      return Buffer.from('NGZkZmQwZjktMDUzOC00MDUxLThjMmEtOWM4NTFhZDc3OTU3bF3jZ1Zj9+8Gv+WptFFAjtrCURVmpp/ShC3'
        + 'oihDXBI/i/6xc7FT7Ji4FaDFbtQQdmHJgvF44CIC0WhDGFcPh/ImdvYZPuzFO6eNSwMo3kaU=', 'base64');
    },
  },
};

export const credStashKey: StaticData = {
  name: 'some.secret.apiKey',
  contents: 'RPg3JNZPfZJZ80pq7qQ=',
  version: '0000000000000000001',
  hmac: '910af4beee82fc5717cddf28c7c16c38d3c2e74424b3cc928869b28293ab937e',
  digest: 'SHA256',
  get key() {
    return Buffer.from([
      254,
      231,
      224,
      213,
      205,
      4,
      48,
      224,
      59,
      181,
      94,
      206,
      200,
      202,
      0,
      252,
    ]).toString('base64');
  },
  plainText: 'someLongAPIKey',
  kms: {
    get CiphertextBlob() {
      return Buffer.from([
        254,
        231,
        224,
        213,
        205,
        4,
        48,
        224,
        59,
        181,
        94,
        206,
        200,
        202,
        0,
        252,
      ]);
    },
    get Plaintext() {
      return Buffer.from([
        143,
        152,
        50,
        72,
        54,
        148,
        70,
        39,
        132,
        170,
        101,
        57,
        226,
        195,
        170,
        198,
        84,
        95,
        89,
        106,
        229,
        110,
        193,
        193,
        184,
        109,
        87,
        37,
        91,
        231,
        132,
        251,
        174,
        236,
        20,
        138,
        246,
        196,
        219,
        209,
        53,
        247,
        142,
        3,
        223,
        126,
        160,
        229,
        254,
        223,
        168,
        229,
        175,
        217,
        85,
        28,
        92,
        178,
        198,
        133,
        40,
        98,
        142,
        36,
      ]);
    },
  },
};
