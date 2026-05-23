// Single interface pages and components use to talk to "the backend".
// Today this re-exports the in-memory mock; in a later plan it swaps to
// real fetch() calls. Importers should NEVER reach into ./mocks directly.

export {
  getCurrentUser,
  listMyCarts,
  getCartBySlug,
  getCartById,
  createCart,
  updateCart,
  addProductToCart,
  removeProductFromCart,
  reorderProducts,
  fetchOG,
} from "./mocks";
