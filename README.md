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

### Push a Blob
A blob is identified by the digest of what it holds, which `Digest.of` computes.
```ts
import { ClientV2, Digest } from '@lesomnus/oci-client'

const client = new ClientV2('localhost:5000')
const repo = client.repo('my/app')

const data = new TextEncoder().encode('...')
await repo.blobs.upload(await Digest.of(data), data).unwrap()
```
Note that it is computed by the Web Crypto API, which a browser serves only in
a secure context. Use `blobs.startUpload` with a hasher of your own for the data
that is too large to be held at once.

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

### Know the Registry
`detect` tells what the registry can be asked for, which is what decides whether
an extension is worth composing. It is not the same question as which
implementation serves it: a *zot* built without its extensions is still *zot*
yet serves no search, and `/v1/search` is served by *Docker Hub* and *quay.io*
alike although neither says what it is.
```ts
import { ClientV2, ext } from '@lesomnus/oci-client'

const Domain = 'quay.io'

const v = await new ClientV2(Domain).detect().unwrap()
console.log(v.features)
// { search: 'v1', catalog: true }

// The dialect names the extension that speaks it, so the two compose a client
// for whichever registry is on the other end.
const Search = ext.search.of(v.features.search)
if (Search !== undefined) {
	const client = ClientV2.with(Search).make(Domain)
	const found = await client.search('prometheus', { n: 10 }).unwrap()
}
```

What the registry advertises is read first since it is a fact it states, and
what is not advertised is probed. `flavor` reports the implementation where it
can be told, which most of the hosted registries do not say:

| Registry          | `features.search` | `features.catalog` | `flavor`       |
| ----------------- | ----------------- | ------------------ | -------------- |
| *zot*             | `zot`             | `true`             | `zot` `v2.1.20` |
| *zot* w/o ext.    | —                 | `true`             | `zot`          |
| *distribution*    | —                 | `true`             | `distribution` |
| *Docker Hub*      | `v1`              | — needs auth       | —              |
| *quay.io*         | `v1`              | `true`             | —              |
| *ghcr.io*         | —                 | — needs auth       | —              |
| *registry.k8s.io* | —                 | `false`            | —              |

`discover` asks only for the extensions the registry advertises, without
probing. A registry that does not implement the discovery answers
`404 Not Found`, which is reported as no extension.
```ts
const { extensions } = await client.discover().unwrap()
```

### Use Extensions
Extensions add APIs that are not a part of the distribution spec.
```ts
import { ClientV2, ext } from '@lesomnus/oci-client'

const client = ClientV2.with(ext.Catalog).make('localhost:5000')

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

*Docker Hub* and *ghcr.io* are tested on a schedule rather than on every change
since they are outside this repository and are rate limited. Reading a public
image is covered on both, and writing to, deleting from and reading a private
repository is covered on *Docker Hub*.

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

*Docker Hub* serves all of it but `end-10`, which answers `405 Method Not
Allowed`: a manifest can be deleted while the blob it pointed at stays.
`ghcr.io` answers `404 Not Found` for a manifest request that does not say what
it accepts, so the client always states it.

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

const client = ClientV2.with(ext.search.V1).make('index.docker.io')

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
const client = ClientV2.with(ext.search.Zot).make('localhost:5000')

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
