# MNEE Treasury Manager

A web application for managing and deploying MNEE token treasuries with spending limits, whitelists, and migration capabilities.

## Setup Instructions

### 1. Contract Configuration

Update the contract addresses in `src/lib/contracts/config.ts`:

```typescript
export const CONTRACT_ADDRESSES = {
  // Replace with your deployed TreasuryFactory address
  TREASURY_FACTORY: "0xYourTreasuryFactoryAddress",
  // Replace with your MNEE Token address
  MNEE_TOKEN: "0xYourMNEETokenAddress",
} as const;
```

### 2. Network Configuration

Update the RPC URL in `src/lib/contracts/config.ts` to point to your network:

```typescript
export const FORKED_MAINNET_CHAIN = {
  // ...
  rpcUrls: {
    default: {
      http: ["https://your-rpc-url-here"],
    },
  },
  // ...
} as const;
```

### 3. Token Configuration

If your token has different decimals or symbol, update in `src/lib/contracts/config.ts`:

```typescript
export const TOKEN_CONFIG = {
  MNEE: {
    symbol: "MNEE",
    decimals: 18, // Update if different
    name: "MNEE Token",
  },
} as const;
```

## Development

```sh
# Install dependencies
npm install

# Start development server
npm run dev
```

## Technologies

- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- wagmi + viem for Web3
- Supabase for backend

## Features

- Deploy new treasuries via TreasuryFactory
- Manage spending limits and periods
- Whitelist management
- Migration support
- Transaction history tracking
