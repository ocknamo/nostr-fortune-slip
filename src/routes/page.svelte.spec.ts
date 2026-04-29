import { page } from '@vitest/browser/context';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

afterEach(() => {
  localStorage.clear();
});

describe('/+page.svelte', () => {
  it('renders the default Pray button when test mode is off', async () => {
    render(Page);

    const button = page.getByRole('button', { name: /Pray for 100 sats/i });
    await expect.element(button).toBeInTheDocument();

    const banner = page.getByText(/TEST MODE/i);
    await expect.element(banner).not.toBeInTheDocument();
  });

  it('shows the test-mode banner and relabels the button when testMode is on', async () => {
    localStorage.setItem('testMode', 'true');

    render(Page);

    const banner = page.getByText(/TEST MODE/i);
    await expect.element(banner).toBeInTheDocument();

    const testButton = page.getByRole('button', { name: /Test draw \(no zap\)/i });
    await expect.element(testButton).toBeInTheDocument();

    const prayButton = page.getByRole('button', { name: /Pray for/i });
    await expect.element(prayButton).not.toBeInTheDocument();
  });
});
