import * as lib from './index'

function expectTypeExists<_T>() {}

test('export', () => {
	expect(lib.Chunk).to.be.exist
	expect(lib.Codes).to.be.exist
	expect(lib.Digest).to.be.exist
	expect(lib.ResError).to.be.exist
	expect(lib.Range).to.be.exist
	expect(lib.Ref).to.be.exist
	expect(lib.result).to.be.exist

	expect(lib.FetchTransport).to.be.exist
	expect(lib.TransportChain).to.be.exist
	expect(lib.Accept).to.be.exist
	expect(lib.Unsecure).to.be.exist
	expect(lib.PathRewrite).to.be.exist
	expect(lib.PathPrefix).to.be.exist

	expect(lib.BlobsApiV2).to.be.exist
	expect(lib.ManifestsApiV2).to.be.exist
	expect(lib.ReferrersApiV2).to.be.exist
	expect(lib.TagsApiV2).to.be.exist

	expect(lib.RepoV2).to.be.exist
	expect(lib.ClientV2).to.be.exist
	expect(lib.TransportAuthorizer).to.be.exist
	expect(lib.parseChallenge).to.be.exist
	expect(lib.urlOf).to.be.exist
	expect(lib.methodOf).to.be.exist
	expect(lib.withUrl).to.be.exist
	expect(lib.withHeaders).to.be.exist

	expect(lib.ext.Catalog).to.be.exist

	expectTypeExists<lib.MediaType>()
	expectTypeExists<lib.ClientInit>()
	expectTypeExists<lib.ErrorEntry>()
	expectTypeExists<lib.ErrorResponse>()
	expectTypeExists<lib.Unwrapped<object>>()
	expectTypeExists<lib.ClientMixin>()
	expectTypeExists<lib.Credential>()
	expectTypeExists<lib.CredentialProvider>()
	expectTypeExists<lib.Challenge>()
})
