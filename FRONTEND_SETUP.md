# 🎨 Frontend Setup - ZK Tickets

## ✅ Frontend Completo Creado

Se ha creado un frontend completo con Next.js que incluye:

### 📦 Componentes Creados:
- ✅ **WalletButton** - Conexión de wallet con RainbowKit
- ✅ **CreateEvent** - Crear eventos/colecciones NFT
- ✅ **GenerateIdentity** - Generar identidad privada localmente
- ✅ **AddToGroup** - Agregar miembro al Merkle tree
- ✅ **FreezeGroup** - Congelar grupo antes de generar proofs
- ✅ **GenerateProof** - Generar ZK proof en el browser
- ✅ **VerifyProof** - Verificar proof on-chain

### 🛠 Stack Tecnológico:
- **Next.js 14** - Framework React
- **wagmi v2** - Hooks de Ethereum
- **RainbowKit** - UI de conexión de wallet
- **snarkjs** - Generación de ZK proofs
- **TailwindCSS** - Estilos
- **TypeScript** - Type safety

---

## 🚀 Instrucciones de Setup

### 1. Instalar Dependencias

```bash
cd frontend
npm install
```

### 2. Copiar Archivos de Circuitos

```bash
# Desde la raíz del proyecto
mkdir -p frontend/public/circuits
cp circuits/semaphore_js/semaphore.wasm frontend/public/circuits/
cp circuits/semaphore_final.zkey frontend/public/circuits/
```

O ejecutar el script:
```bash
cd frontend
bash scripts/setup.sh
```

### 3. Configurar Contratos (Opcional)

Si quieres usar direcciones personalizadas, crea `frontend/.env.local`:

```env
NEXT_PUBLIC_NFT_FACTORY_ADDR=0x...
NEXT_PUBLIC_GROUP_MANAGER_ADDR=0x...
NEXT_PUBLIC_ZK_VERIFIER_ADDR=0x...
```

**Por defecto**, el frontend usa las direcciones hardcodeadas en `lib/contracts.ts` que coinciden con Hardhat local.

### 4. Iniciar Hardhat Local Node

```bash
# Terminal 1 - Desde la raíz del proyecto
npx hardhat node
```

### 5. Deployar Contratos

```bash
# Terminal 2 - Desde la raíz del proyecto
npx hardhat run scripts/deployAll.ts --network localhost
```

**Nota:** Las direcciones por defecto en `frontend/lib/contracts.ts` deberían coincidir con las de Hardhat local. Si no, actualiza el archivo o usa `.env.local`.

### 6. Iniciar Frontend

```bash
# Terminal 3
cd frontend
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 📋 Flujo de Uso

1. **Conectar Wallet** - Click en "Connect Wallet" y selecciona MetaMask
2. **Crear Evento** - Ingresa Context ID y nombre del evento, click "Create Event"
3. **Generar Identidad** - Click "Generate Identity" (se genera localmente)
4. **Agregar al Grupo** - Ingresa ticket type, click "Add to Group"
5. **Congelar Grupo** - Click "Freeze Group" (necesario antes de generar proofs)
6. **Generar Proof** - Click "Generate Proof" (puede tomar 10-30 segundos)
7. **Verificar** - Click "Verify Proof" para verificar on-chain

---

## 🎯 Características

- ✅ **Conexión de Wallet** - MetaMask, WalletConnect, etc.
- ✅ **Generación de Identidad Local** - Nunca se comparte
- ✅ **Generación de Proofs en Browser** - Usando snarkjs + WASM
- ✅ **Verificación On-Chain** - Transacciones reales
- ✅ **UI Moderna** - TailwindCSS con diseño limpio
- ✅ **Estado en Tiempo Real** - Muestra estado de transacciones

---

## 🔧 Troubleshooting

### Error: "Circuit files not found"
- Asegúrate de copiar `semaphore.wasm` y `semaphore_final.zkey` a `frontend/public/circuits/`

### Error: "Contract not found"
- Verifica que Hardhat node esté corriendo
- Verifica que los contratos estén deployados
- Actualiza direcciones en `lib/contracts.ts` o `.env.local`

### Error: "Proof generation failed"
- Verifica que los archivos de circuito estén en `public/circuits/`
- Verifica que el navegador soporte WebAssembly
- Revisa la consola del navegador para más detalles

### Error: "Network not found"
- Asegúrate de tener Hardhat network configurada en MetaMask
- O cambia a Sepolia/Optimism Sepolia en el frontend

---

## 📝 Notas Importantes

1. **Hardhat Local Network:**
   - Chain ID: 31337
   - RPC URL: http://localhost:8545
   - Agrega esta red a MetaMask para testing

2. **Gas:**
   - Hardhat local tiene gas ilimitado
   - No necesitas ETH real para testing local

3. **Privacidad:**
   - Las identidades se generan y almacenan localmente
   - Nunca se envían al servidor
   - Los proofs se generan en el browser

---

## 🎉 Listo para Demo!

El frontend está completamente funcional y listo para:
- ✅ Demo en vivo
- ✅ Screenshots
- ✅ Video/GIF
- ✅ Presentación

¡Todo listo! 🚀


