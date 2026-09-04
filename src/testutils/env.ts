// `process` is not available in the browser so the value is injected by Vite.
// See `envPrefix` in the Vite config.
export const Domain = import.meta.env.REGISTRY_DOMAIN ?? 'registry:5000'
