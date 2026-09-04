# OCI Client

[![Test](https://github.com/lesomnus/oci-client/actions/workflows/test.yaml/badge.svg)](https://github.com/lesomnus/oci-client/actions/workflows/test.yaml)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/d8725577ee654965877ee0be066e7c06)](https://app.codacy.com/gh/lesomnus/oci-client/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/d8725577ee654965877ee0be066e7c06)](https://app.codacy.com/gh/lesomnus/oci-client/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_coverage)

Client implementation of [*OCI*](https://opencontainers.org/) [*Distribution*](https://github.com/opencontainers/distribution-spec).
It is designed to work in the browser but keeps *Node.js* in mind.

## Install
```bash
npm i @lesomnus/oci-client
```



## Usage

### List Tags
```ts
import { ClientV2 } from '@lesomnus/oci-client'

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
import { ClientV2 } from '@lesomnus/oci-client'
import { vnd } from '@lesomnus/oci-client/media-types'

const client = new ClientV2('index.docker.io')
await client.ping()

const opaque = await client.repo('library/node').manifests.get('latest').unwrap()
const index = opaque.as(vnd.oci.image.indexV1)
console.log(index?.manifests[0].platform?.os)
// "linux"
```

### Authenticate
A credential is used to obtain a token from the authentication service the
registry points to, or to answer a `Basic` challenge directly.
The obtained token is reused for the following requests to the same repository.
```ts
import { ClientV2 } from '@lesomnus/oci-client'

const client = new ClientV2('index.docker.io', {
	credential: { username: 'j.doe', password: '...' },
})

// The credential can be resolved by the realm of the challenge.
const other = new ClientV2('index.docker.io', {
	credential: realm => (realm.endsWith('.docker.io') ? { username: 'j.doe', password: '...' } : undefined),
})
```

### Use Extensions
Extensions add APIs that are not a part of the distribution spec.
```ts
import { ClientV2, ext } from '@lesomnus/oci-client'

const Client = ClientV2.with(ext.Catalog)
const client = new Client('localhost:5000')

const v = await client.catalog({ n: 10 }).unwrap()
console.log(v.repositories)
```



## Tested Registries

Every change is tested against the registries below on the two most recent LTS
versions of *Node.js*, in *Node.js* and in the browser.

| Registry                                                     | Version   |
| ------------------------------------------------------------ | --------- |
| [zot](https://zotregistry.dev/)                              | `v2.1.20` |
| [distribution](https://distribution.github.io/distribution/) | `v3.1.1`  |
| [distribution](https://distribution.github.io/distribution/) | `v2.8.3`  |

The spec leaves some of the behaviors to the registry and not every registry
complies with all of it. This client smooths over what it can:

| Behavior                                                | *zot* | *distribution v3* | *distribution v2* |
| -------------------------------------------------------- | ----- | ----------------- | ----------------- |
| `end-4b` stores the blob in a single request            | ✅    | ❌ answers `202`  | ❌ answers `202`  |
| `end-5`  `416` for a chunk uploaded out of order        | ✅    | ✅                | ❌ answers `202`  |
| `end-8a` lists the tags in lexical order                | ✅    | ✅                | ❌                |
| `end-8b` paginates the tags by `n` and `last`           | ✅    | ✅                | ❌ lists them all |
| `end-8b` `404` for a repository that does not exist     | ✅    | ❌ answers `200`  | ✅                |
| `end-12` Referrers API                                  | ✅    | ❌                | ❌                |

`end-4b` and `end-12` are handled by the client, so a blob is uploaded and the
referrers are listed whichever registry is on the other end. The rest is the
registry answering differently for the same request.

## Implemented APIs

### OCI

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

`end-4b` and `end-12` are answered differently depending on the registry and
this client handles both, see [Tested Registries](#tested-registries).

### Search

Search the repositories of the registry.

Searching is not a part of the distribution spec so every registry does it its
own way. Each implementation is provided separately and they share the same
`search` so the code that uses it does not have to know which one is behind.
A field is left out where the registry does not report it.

| Extension          | Registry                | API                                          |
| ------------------ | ----------------------- | -------------------------------------------- |
| `ext.search.Zot`   | *zot*                   | GraphQL on `/v2/_zot/ext/search`             |
| `ext.search.V1`    | *Docker Hub* and alike  | `GET /v1/search?q=<term>&n=<integer>&page=<integer>` |

```ts
import { ClientV2, ext } from '@lesomnus/oci-client'

const Client = ClientV2.with(ext.search.V1)
const client = new Client('index.docker.io')

const v = await client.search('nginx', { n: 3 }).unwrap()
console.log(v.total, v.repositories[0])
// 292148 {
//   name: 'nginx',
//   description: 'Official build of Nginx.',
//   stars: 21369,
//   downloads: 13328112634,
//   official: true
// }
```

`ext.search.Zot` also exposes `graphql` for the queries that `search` does not
cover, such as the vulnerabilities or the referrers zot indexes.
Note that the search extension has to be enabled on *zot*;
`/v2/_oci/ext/discover` tells whether it is.

```ts
const Client = ClientV2.with(ext.search.Zot)
const client = new Client('localhost:5000')

const v = await client
	.graphql<{ ImageList: { Results: { Tag: string }[] } }>('query($repo: String!) { ImageList(repo: $repo) { Results { Tag } } }', {
		repo: 'library/node',
	})
	.unwrap()
```

### Catalog

List image repositories.

Complies:
- [Zot Registry](https://zotregistry.dev/v2.1.0/developer-guide/api-reference/#get-v2_catalog)
- [distribution/distribution](https://github.com/distribution/distribution/blob/4772604ae973031ab32dd9805a4bccf61d94909f/docs/spec/api.md#listing-repositories)

| Method | API Endpoint                                    |
| ------ | ----------------------------------------------- |
| `GET`  | `/v2/_catalog`                                  |
| `GET`  | `/v2/_catalog?n=<integer>&last=<repository>`    |
