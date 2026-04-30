import { useAuth } from '../context/AuthContext';

/**
 * Renders the current user's brand logo.
 * Falls back to /redrock-logo.svg when no custom logo has been uploaded.
 *
 * In publicMode (share pages) pass the brand object directly because the
 * viewer isn't authenticated — the brand comes from the scan payload instead
 * of AuthContext.
 *
 * Props:
 *   height      {number|string}  CSS height (default 28)
 *   style       {object}         Extra inline styles
 *   publicBrand {object}         Brand dict for public/share-page rendering
 *   onClick     {function}       Optional click handler
 */
export default function BrandLogo({ height = 28, style = {}, publicBrand, onClick }) {
  const auth = useAuth();
  // publicBrand wins over auth context for share pages
  const brand = publicBrand || auth?.brand || {};

  const src  = brand.logo_url  || '/lokscope-logo.png';
  const name = brand.brand_name || 'Lokscope';

  return (
    <img
      src={src}
      alt={name}
      onClick={onClick}
      style={{
        height,
        width: 'auto',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    />
  );
}
