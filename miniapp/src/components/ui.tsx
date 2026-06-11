import styled, { keyframes } from 'styled-components';
import { css } from '../theme';

export const Screen = styled.div`
  min-height: 100vh;
  background: ${css.bg};
  color: ${css.text};
  font-family: 'Outfit', -apple-system, system-ui, sans-serif;
  padding-bottom: 24px;
`;

export const Card = styled.div`
  background: ${css.bg};
  border: 1px solid color-mix(in srgb, ${css.hint} 22%, transparent);
  border-radius: 16px;
  padding: 14px;
  margin: 10px 12px;
`;

export const Pill = styled.span<{ $accent?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 8px;
  background: ${(p) =>
    p.$accent ? 'color-mix(in srgb, #2DD4A8 18%, transparent)' : css.secondaryBg};
  color: ${(p) => (p.$accent ? '#15997a' : css.text)};
`;

export const Button = styled.button<{ $variant?: 'primary' | 'ghost' }>`
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s;
  background: ${(p) => (p.$variant === 'ghost' ? css.secondaryBg : css.button)};
  color: ${(p) => (p.$variant === 'ghost' ? css.text : css.buttonText)};
  &:active {
    opacity: 0.8;
  }
  &:disabled {
    opacity: 0.5;
  }
`;

const spin = keyframes`to { transform: rotate(360deg); }`;
export const Spinner = styled.div`
  width: 28px;
  height: 28px;
  border: 3px solid ${css.secondaryBg};
  border-top-color: ${css.button};
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
  margin: 40px auto;
`;

export const Center = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 24px;
  text-align: center;
  color: ${css.hint};
`;

export function formatSalary(
  min: number | null,
  max: number | null,
  currency: 'UZS' | 'USD',
): string {
  const unit = currency === 'USD' ? '$' : "so'm";
  const f = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (min && max && min !== max) return `${f(min)}–${f(max)} ${unit}`;
  if (min) return `${f(min)} ${unit}`;
  return 'Kelishilgan';
}

export const EMPLOYMENT_LABEL: Record<string, string> = {
  FULL_TIME: "To'liq",
  PART_TIME: 'Yarim stavka',
  REMOTE: 'Masofaviy',
  SHIFT: 'Smenali',
};
