import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the potato disease classifier', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /a closer look at your potato leaf/i })).toBeInTheDocument();
});
