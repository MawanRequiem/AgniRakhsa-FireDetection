import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Custom render function that wraps components in necessary providers (like Router).
 * Follows testing-patterns skill.
 */
export const renderWithProviders = (ui, { route = '/' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
};
