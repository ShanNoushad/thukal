import './globals.css';

export const metadata = {
  title: 'Product Manager',
  description: 'Add products with margin and offer pricing',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
