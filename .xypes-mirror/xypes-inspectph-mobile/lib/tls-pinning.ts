/**
 * TLS Certificate Pinning scaffold for Inspect PH Mobile
 *
 * ## Status
 * Scaffolded — requires production certificate hashes before activation.
 *
 * ## How to activate
 *
 * 1. Install the library:
 *    ```
 *    npx expo install react-native-ssl-public-key-pinning
 *    ```
 *
 * 2. Obtain the SPKI (Subject Public Key Info) SHA-256 hash for the API domain:
 *    ```bash
 *    openssl s_client -connect api.inspectph.gov.ph:443 -servername api.inspectph.gov.ph \
 *      </dev/null 2>/dev/null \
 *      | openssl x509 -pubkey -noout \
 *      | openssl pkey -pubin -outform der \
 *      | openssl dgst -sha256 -binary \
 *      | base64
 *    ```
 *    Store the result in `EXPO_PUBLIC_API_TLS_PIN` in `.env.production`.
 *
 * 3. In `lib/api.ts`, import `initializeSslPinning` from
 *    `react-native-ssl-public-key-pinning` and call it once at module load:
 *
 *    ```typescript
 *    import { initializeSslPinning } from "react-native-ssl-public-key-pinning";
 *
 *    const apiHost = new URL(API_BASE_URL).hostname;
 *    const tlsPin = process.env.EXPO_PUBLIC_API_TLS_PIN;
 *    if (tlsPin && apiHost) {
 *      initializeSslPinning({
 *        [apiHost]: {
 *          includeSubdomains: false,
 *          publicKeyHashes: [tlsPin],
 *        },
 *      });
 *    }
 *    ```
 *
 * 4. Trigger a new EAS build (`eas build --profile production`) so the native
 *    layer picks up the pinning configuration.
 *
 * ## Certificate rotation
 * - Pin the **intermediate CA** key rather than the leaf certificate so that
 *   regular leaf-cert renewals (e.g. Let's Encrypt 90-day certs) don't break
 *   the app.
 * - Always pin at least two keys simultaneously: the active key and the next
 *   scheduled key, to enable zero-downtime rotation.
 * - Publish a new EAS update (`eas update`) with the new pin hashes at least
 *   14 days before rotating the certificate.
 *
 * ## References
 * - https://docs.expo.dev/versions/latest/sdk/ssl-pinning/ (if Expo First-Party
 *   module ships)
 * - https://github.com/frw/react-native-ssl-public-key-pinning
 */

export {}; // Make this a module so TypeScript doesn't treat it as a script
