# OCI Client

[![Test](https://github.com/lesomnus/oci-client/actions/workflows/test.yaml/badge.svg)](https://github.com/lesomnus/oci-client/actions/workflows/test.yaml)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/d8725577ee654965877ee0be066e7c06)](https://app.codacy.com/gh/lesomnus/oci-client/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/d8725577ee654965877ee0be066e7c06)](https://app.codacy.com/gh/lesomnus/oci-client/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_coverage)

Client implementation of [*OCI*](https://opencontainers.org/) [*Distribution*](https://github.com/opencontainers/distribution-spec).
It is designed to work in the browser but keeps *Node.js* in mind.

## Install
> Not yet
```bash
npm i @lesomnus/oci-client
```



## Usage

### List Tags
```ts
import { ClientV2 } from '@lesomns/oci-client'

const client = new ClientV2('index.docker.io')
await client.ping()

const v = await client.repo('library/node').tags.list().unwrap()
console.log(v)
// {
//   "name": "library/node",
//   "tags": [
//     ...
//   ]
// }
```

### Get Manifest
```ts
import { ClientV2 } from '@lesomns/oci-client'
import { oci } from '@lesomnus/oci-client/media-types'

const client = new ClientV2('index.docker.io')
await client.ping()

const opaque = await client.repo('library/node').manifests.get('latest').unwrap()
const index = opaque.as(oci.image.indexV1)
console.log(index?.manifests[0].platform.os)
// "linux"
```



## Implemented APIs

All APIs are implemented as described in [Distribution spec v1.1.0](https://github.com/opencontainers/distribution-spec/blob/0f98d91a0afe7ed3ab0f29349beed2bb4ba1507d/spec.md).

| ID      | Method         | API Endpoint                                                 |
| ------- | -------------- | ------------------------------------------------------------ |
| end-1   | `GET`          | `/v2/`                                                       |
| end-2   | `GET` / `HEAD` | `/v2/<name>/blobs/<digest>`                                  |
| end-3   | `GET` / `HEAD` | `/v2/<name>/manifests/<reference>`                           |
| end-4a  | `POST`         | `/v2/<name>/blobs/uploads/`                                  |
| end-4b  | `POST`         | `/v2/<name>/blobs/uploads/?digest=<digest>`                  |
| end-5   | `PATCH`        | `/v2/<name>/blobs/uploads/<reference>`                       |
| end-6   | `PUT`          | `/v2/<name>/blobs/uploads/<reference>?digest=<digest>`       |
| end-7   | `PUT`          | `/v2/<name>/manifests/<reference>`                           |
| end-8a  | `GET`          | `/v2/<name>/tags/list`                                       |
| end-8b  | `GET`          | `/v2/<name>/tags/list?n=<integer>&last=<tagname>`            |
| end-9   | `DELETE`       | `/v2/<name>/manifests/<reference>`                           |
| end-10  | `DELETE`       | `/v2/<name>/blobs/<digest>`                                  |
| end-11  | `POST`         | `/v2/<name>/blobs/uploads/?mount=<digest>&from=<other_name>` |
| end-12a | `GET`          | `/v2/<name>/referrers/<digest>`                              |
| end-12b | `GET`          | `/v2/<name>/referrers/<digest>?artifactType=<artifactType>`  |
| end-13  | `GET`          | `/v2/<name>/blobs/uploads/<reference>`                       |

