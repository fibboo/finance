import styles from './exchange-rate-source.module.css';

const EXCHANGE_RATE_PROVIDER_URL = 'https://www.exchangerate-api.com';

type ExchangeRateSourceProps = Readonly<{ className?: string | undefined }>;

export function ExchangeRateSource({ className }: ExchangeRateSourceProps) {
  return (
    <a
      href={EXCHANGE_RATE_PROVIDER_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="ExchangeRate-API, opens in a new tab"
      className={`${styles['exchangeRateSource'] ?? ''} ${className ?? ''}`}
    >
      ExchangeRate-API ↗
    </a>
  );
}
