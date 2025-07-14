import { render, screen } from '@testing-library/react';
import App from '../src/App.jsx';
import { describe, it, expect } from 'vitest';

describe('App', () => {
  it('renders ArchLens 概要', () => {
    render(<App />);
    expect(screen.getByText(/ArchLens 概要/)).toBeInTheDocument();
  });
}); 