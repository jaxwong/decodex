import PropTypes from 'prop-types';
import { HashRouter, MemoryRouter, Routes, Route } from 'react-router-dom';

// HashRouter needs a real page URL. Inside sandboxed previews (about:srcdoc / blob:)
// that URL is invalid, so fall back to an in-memory router that starts on the cart.
const hasRealUrl = (() => {
  try { return ['http:', 'https:', 'file:'].includes(window.location.protocol) && !!new URL('/', window.location.href); }
  catch { return false; }
})();
const Router = ({ children }) => hasRealUrl
  ? <HashRouter>{children}</HashRouter>
  : <MemoryRouter initialEntries={['/Cart']}>{children}</MemoryRouter>;
import Nav from './components/Navigation/Nav';
import SellerNav from './components/Navigation/SellerNav';
import SubNav from './components/SubNavigation/SubNav';
import Landing from './components/Landing';
import Footer from './components/Footer/Footer';
import Info from './components/Info';
import Category from './components/Section/category';
import Discovery from './components/Section/discovery';
import Cart from './components/Section/cart';
import Checkout from './components/Section/Checkout';
import OrderConfirmation from './components/Section/OrderConfirmation';
import Compare from './components/Section/Compare';
import SellerCentre from './components/Section/SellerCentre';
import SearchResults from './components/Section/SearchResults';
import ProductPage from './components/Section/ProductPage';
import { ShopProvider } from './shop';

// Buyer pages share the Shopee storefront chrome.
const BuyerLayout = ({ children }) => (
  <>
    <Nav />
    <SubNav />
    {children}
    <Footer />
  </>
);

// Seller Centre is a different product with its own header: no search, cart or buyer links.
const SellerLayout = ({ children }) => (
  <>
    <SellerNav />
    {children}
  </>
);

const layoutPropTypes = {
  children: PropTypes.node.isRequired,
};

Router.propTypes = layoutPropTypes;
BuyerLayout.propTypes = layoutPropTypes;
SellerLayout.propTypes = layoutPropTypes;

function App() {
  return (
    <Router>
      <ShopProvider>
        <Routes>
          <Route path="/" element={<BuyerLayout><Landing /><Category/><Discovery/><Info/></BuyerLayout>} />
          <Route path="/Search" element={<BuyerLayout><SearchResults/></BuyerLayout>}/>
          <Route path="/Product/:listingId" element={<BuyerLayout><ProductPage/></BuyerLayout>}/>
          <Route path="/Cart" element={<BuyerLayout><Cart/></BuyerLayout>}/>
          <Route path="/Compare" element={<BuyerLayout><Compare/></BuyerLayout>}/>
          <Route path="/Checkout" element={<BuyerLayout><Checkout/></BuyerLayout>}/>
          <Route path="/OrderConfirmation" element={<BuyerLayout><OrderConfirmation/></BuyerLayout>}/>
          <Route path="/SellerCentre" element={<SellerLayout><SellerCentre/></SellerLayout>}/>
        </Routes>
      </ShopProvider>
    </Router>
  );
}

export default App;
