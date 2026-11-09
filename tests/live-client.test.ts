import { describe, it, expect } from 'vitest';
import { parseSseChunk } from '../services/liveClient';

describe('parseSseChunk', () => {
    it('separa eventos completos e guarda o resto incompleto', () => {
        const { events, rest } = parseSseChunk(': ok\n\ndata: {"a":1}\n\ndata: {"b":');
        expect(events).toEqual(['{"a":1}']);
        expect(rest).toBe('data: {"b":');
    });
    it('ignora comentarios/heartbeats e aceita CRLF', () => {
        const { events, rest } = parseSseChunk(': ping\r\n\r\ndata:{"x":2}\r\n\r\n');
        expect(events).toEqual(['{"x":2}']);
        expect(rest).toBe('');
    });
});
