import React from 'react';
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
import SubNav from './components/SubNavigation/SubNav';
import Landing from './components/Landing';
import Footer from './components/Footer/Footer';
import Login from './components/Authentication/Login';
import Info from './components/Info';
import LoginNav from './components/Navigation/LoginNav';
import Category from './components/Section/category';
import Discovery from './components/Section/discovery';
import Cart from './components/Section/cart';
import Checkout from './components/Section/Checkout';
import OrderConfirmation from './components/Section/OrderConfirmation';
import Signup from './components/Authentication/Signup';
import Compare from './components/Section/Compare';
import { CompareProvider } from './compare/CompareContext';

const MainLayout = ({ children }) => (
  <>
    <Nav />
    <SubNav />
    {children}
    <Footer />
  </>
);

const SubNavLayout = ({ children }) => (
  <>
    <LoginNav/>
    {children}
    <Footer />
  </>
);
const AddtoCart = ({children}) => (
  <>
  <Nav/>
  {children}
  <Footer/>
  </>
)

function App() {
  return (
    <CompareProvider>
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout><Landing /><Category/><Discovery/><Info/></MainLayout>} />
        <Route path="/Login" element={<SubNavLayout><Login /></SubNavLayout>} />
        <Route path="/Signup" element={<SubNavLayout><Signup /></SubNavLayout>} />
        <Route path="/Cart" element={<AddtoCart><Cart/></AddtoCart>}/>
        <Route path="/Compare" element={<AddtoCart><Compare/></AddtoCart>}/>
        <Route path="/Checkout" element={<AddtoCart><Checkout/></AddtoCart>}/>
        <Route path="/OrderConfirmation" element={<AddtoCart><OrderConfirmation/></AddtoCart>}/>
      </Routes>
    </Router>
    </CompareProvider>
  );
}

export default App;