/**
 * StatusBar — Barra inferior com coordenadas, SRID, escala
 */
import { useApp } from '../pages/AppShell';

export default function StatusBar() {
    const { mapCursor, loteAtual } = useApp();

    return (
        <footer className="app-statusbar">
            <div className="app-statusbar-item">
                <span className="app-statusbar-label">SRID</span>
                <span className="app-statusbar-value">4674 (SIRGAS 2000)</span>
            </div>

            <div className="app-statusbar-item">
                <span className="app-statusbar-label">Coords</span>
                <span className="app-statusbar-value">
                    {mapCursor
                        ? `${mapCursor.lat.toFixed(6)}, ${mapCursor.lon.toFixed(6)}`
                        : '—, —'}
                </span>
            </div>

            {loteAtual && (
                <div className="app-statusbar-item">
                    <span className="app-statusbar-label">Lote</span>
                    <span className="app-statusbar-value">
                        #{loteAtual.id} · {loteAtual.status || 'PENDENTE'}
                    </span>
                </div>
            )}

            <div className="app-statusbar-item app-statusbar-right">
                <span className="app-statusbar-value">Desenrola v1.0</span>
            </div>
        </footer>
    );
}
