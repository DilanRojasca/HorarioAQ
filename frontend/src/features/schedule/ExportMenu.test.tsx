import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportMenu from './ExportMenu';
import { api } from '../../shared/api';

vi.mock('../../shared/api', async (orig) => {
  const actual = await orig<typeof import('../../shared/api')>();
  return { ...actual, api: { download: vi.fn() } };
});
const download = api.download as unknown as ReturnType<typeof vi.fn>;

describe('ExportMenu', () => {
  beforeEach(() => { download.mockReset(); });

  it('descarga PDF e .ics', async () => {
    download.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ExportMenu />);
    await user.click(screen.getByRole('button', { name: 'Exportar PDF' }));
    expect(download).toHaveBeenCalledWith('/schedule/me/export?format=pdf', 'horario.pdf');
    await user.click(screen.getByRole('button', { name: 'Exportar .ics' }));
    expect(download).toHaveBeenCalledWith('/schedule/me/export?format=ics', 'horario.ics');
  });

  it('deshabilita los botones mientras exporta y muestra el error en role=alert', async () => {
    let reject!: (e: Error) => void;
    download.mockImplementation(() => new Promise((_, r) => { reject = r; }));
    const user = userEvent.setup();
    render(<ExportMenu />);
    await user.click(screen.getByRole('button', { name: 'Exportar PDF' }));
    expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Exportar .ics' })).toBeDisabled();
    await act(async () => { reject(new Error('No se pudo exportar')); });
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo exportar');
    expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled();
  });
});
