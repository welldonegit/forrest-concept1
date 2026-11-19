const stub = new URL('./sanity-stub.mjs', import.meta.url).href;
export async function resolve(specifier, context, next) {
  if (specifier === 'sanity') return { url: stub, shortCircuit: true };
  return next(specifier, context);
}
