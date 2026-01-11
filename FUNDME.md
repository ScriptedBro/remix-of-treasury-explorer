# Funding MNEE on an Anvil Mainnet Fork (Whale Impersonation)

This repo is typically used against an Anvil mainnet fork (chain id `31337`). Funding the treasury (or your wallet) with MNEE is done by **impersonating an existing MNEE holder (“whale”)** and sending an ERC-20 transfer.

## Prereqs

- `anvil` and `cast` installed (Foundry).
- A mainnet RPC URL (Alchemy/Infura/etc.) exported as `MAINNET_RPC_URL`.

## Addresses

- **MNEE token (mainnet):** `0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF`
- **MNEE whale:** `<PUT_WHALE_ADDRESS_HERE>`
- **Your wallet (recipient):** `<PUT_YOUR_WALLET_ADDRESS_HERE>`
- **Your treasury (recipient):** `<PUT_TREASURY_ADDRESS_HERE>`

## 1) Start Anvil (mainnet fork)

In one terminal:

```bash
anvil --fork-url "$MAINNET_RPC_URL" --chain-id 31337 --port 8545 --auto-impersonate
```

Notes:
- `--auto-impersonate` lets you use any `--from <address>` with `cast` without needing a private key.

If Anvil is already running **without** `--auto-impersonate`, you can still impersonate accounts manually:

```bash
cast rpc anvil_impersonateAccount <PUT_WHALE_ADDRESS_HERE> --rpc-url http://localhost:8545
```

## 2) (Optional) Ensure the whale has ETH for gas on the fork

On a fork, the whale may or may not have enough ETH to pay gas. You can force-set it:

```bash
cast rpc anvil_setBalance \
  <PUT_WHALE_ADDRESS_HERE> \
  0x3635C9ADC5DEA00000 \
  --rpc-url http://localhost:8545
```

That hex value is `1000 ETH`.

## 3) Check MNEE balances

### Whale balance

```bash
cast call 0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF \
  "balanceOf(address)(uint256)" \
  <PUT_WHALE_ADDRESS_HERE> \
  --rpc-url http://localhost:8545
```

### Recipient balance

```bash
cast call 0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF \
  "balanceOf(address)(uint256)" \
  <PUT_RECIPIENT_ADDRESS_HERE> \
  --rpc-url http://localhost:8545
```

## 4) Transfer MNEE from whale -> recipient (wallet or treasury)

MNEE uses `18` decimals.

### Send 100 MNEE

```bash
cast send 0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF \
  "transfer(address,uint256)(bool)" \
  <PUT_RECIPIENT_ADDRESS_HERE> \
  100000000000000000000 \
  --from <PUT_WHALE_ADDRESS_HERE> \
  --unlocked \
  --rpc-url http://localhost:8545
```

### Send an arbitrary amount

Convert `AMOUNT` MNEE to wei-like units (`AMOUNT * 1e18`). Examples:

- `1 MNEE` -> `1000000000000000000`
- `10 MNEE` -> `10000000000000000000`

## 5) Verify the transfer

Re-run the balance check for the recipient:

```bash
cast call 0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF \
  "balanceOf(address)(uint256)" \
  <PUT_RECIPIENT_ADDRESS_HERE> \
  --rpc-url http://localhost:8545
```

## Troubleshooting

### `Error accessing local wallet...` / `No associated wallet for from address`

- If you started Anvil with `--auto-impersonate`, add `--unlocked` to `cast send`.
- If you did **not** start with `--auto-impersonate`, run:

```bash
cast rpc anvil_impersonateAccount <PUT_WHALE_ADDRESS_HERE> --rpc-url http://localhost:8545
```

Then re-run the `cast send ... --from <PUT_WHALE_ADDRESS_HERE> --unlocked ...` command.

Optional cleanup:

```bash
cast rpc anvil_stopImpersonatingAccount <PUT_WHALE_ADDRESS_HERE> --rpc-url http://localhost:8545
```

### Transfer reverted

Common causes:
- Whale doesn’t actually have enough MNEE on the forked block.
- Whale has no ETH for gas (use `anvil_setBalance` above).

### Confirm you’re pointing at the fork

Make sure you always include:

- `--rpc-url http://localhost:8545`

when calling/sending with `cast`.
