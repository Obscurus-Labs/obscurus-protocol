# 🎫 Guía Paso a Paso - Demo ZK Tickets

## 📋 Pre-requisitos

✅ Frontend corriendo en http://localhost:3000  
✅ Hardhat node corriendo  
✅ Contratos deployados  
✅ MetaMask instalado  

---

## 🔧 Paso 0: Configurar MetaMask para Hardhat Local

Si aún no tienes la red Hardhat configurada:

1. Abre MetaMask
2. Click en el selector de red (arriba)
3. "Add Network" → "Add a network manually"
4. Configura:
   - **Network Name:** `Hardhat Local`
   - **RPC URL:** `http://localhost:8545`
   - **Chain ID:** `31337`
   - **Currency Symbol:** `ETH`
5. Guarda y selecciona esta red

**Nota:** Si no tienes fondos, ejecuta:
```bash
npx hardhat run scripts/sendFunds.ts --network localhost
```
(Reemplaza la dirección en el script con la tuya)

---

## 🚀 Paso 1: Conectar Wallet

1. En http://localhost:3000, busca el botón **"Connect Wallet"** (arriba a la derecha)
2. Click en "Connect Wallet"
3. Selecciona **MetaMask**
4. Acepta la conexión en MetaMask
5. ✅ Deberías ver tu dirección conectada

---

## 📝 Paso 2: Crear un Evento

1. En la sección **"1. Create Event"**:
   - **Context ID:** `1` (o cualquier número único)
   - **Event Name:** `VIP Concert` (o el nombre que quieras)
2. Click en el botón **"Create Event"**
3. MetaMask se abrirá - confirma la transacción
4. Espera a que se complete (puede tardar unos segundos)
5. ✅ Deberías ver: **"✅ Event Created!"** con el hash de la transacción

---

## 🔐 Paso 3: Generar Identidad Privada

1. En la sección **"2. Generate Identity"**:
   - Click en el botón **"Generate Identity"**
   - Espera 2-3 segundos (se genera localmente en tu navegador)
2. ✅ Deberías ver: **"✅ Identity Generated"**
   - Muestra el commitment (nunca se comparte con nadie)
   - **Importante:** Esta identidad se guarda solo en tu navegador

---

## 👥 Paso 4: Agregar al Grupo

1. En la sección **"3. Add to Group"**:
   - **Ticket Type:** `1` (1 = VIP, 2 = General, etc.)
2. Click en el botón **"Add to Group"**
3. MetaMask se abrirá - confirma la transacción
4. Espera a que se complete
5. ✅ Deberías ver: **"✅ Added to Group!"**
   - Tu identidad ahora está en el Merkle tree

---

## 🔒 Paso 5: Congelar el Grupo

1. En la sección **"4. Freeze Group"**:
   - Click en el botón **"Freeze Group"**
   - **Importante:** Esto bloquea el Merkle root. No se pueden agregar más miembros después.
2. MetaMask se abrirá - confirma la transacción
3. Espera a que se complete
4. ✅ Deberías ver: **"✅ Group Frozen!"**
   - El Merkle root está ahora bloqueado

---

## 🔮 Paso 6: Generar ZK Proof

1. En la sección **"5. Generate ZK Proof"**:
   - **Ticket Type:** `1` (debe coincidir con el que usaste en el Paso 4)
   - Verifica que aparezca el Merkle Root (si no aparece, el grupo no está congelado)
2. Click en el botón **"Generate Proof"**
3. ⏳ **ESPERA 10-30 SEGUNDOS** (esto es lo más lento)
   - El proof se genera en tu navegador usando WebAssembly
   - No cierres la pestaña durante este proceso
4. ✅ Deberías ver: **"✅ Proof Generated!"**
   - Muestra el nullifier hash
   - El proof está listo para verificar

---

## ✅ Paso 7: Verificar On-Chain

1. En la sección **"6. Verify On-Chain"**:
   - Click en el botón **"Verify Proof"**
2. MetaMask se abrirá - confirma la transacción
3. Espera a que se complete (puede tardar unos segundos)
4. ✅ Deberías ver: **"✅ Proof Verified!"**
   - El smart contract verificó tu ZK proof
   - Se emitió el evento `AccessGranted`
   - Tu nullifier fue marcado como usado

---

## 🧪 Paso 8: Probar Detección de Duplicado (Opcional)

1. Intenta hacer click en **"Verify Proof"** otra vez
2. ❌ Debería fallar con un error
3. ✅ Esto demuestra que el sistema previene el double-spending
   - El mismo nullifier no puede usarse dos veces

---

## 📊 Resumen del Flujo Completo

```
1. Conectar Wallet
   ↓
2. Crear Evento (NFT Collection)
   ↓
3. Generar Identidad (local, privada)
   ↓
4. Agregar al Grupo (Merkle tree)
   ↓
5. Congelar Grupo (lock Merkle root)
   ↓
6. Generar ZK Proof (10-30 segundos)
   ↓
7. Verificar On-Chain ✅
```

---

## ⚠️ Troubleshooting

### Error: "Please connect your wallet first"
- Asegúrate de haber conectado MetaMask
- Verifica que estés en la red "Hardhat Local"

### Error: "Please generate an identity first"
- Ve al Paso 3 y genera una identidad

### Error: "Please freeze the group first"
- Ve al Paso 5 y congela el grupo antes de generar el proof

### Error: "Circuit files not found"
- Verifica que `public/circuits/semaphore.wasm` y `semaphore_final.zkey` existan
- Si no existen, cópialos desde `circuits/`

### Error: "Insufficient funds"
- Ejecuta: `npx hardhat run scripts/sendFunds.ts --network localhost`
- O usa una de las cuentas predefinidas de Hardhat

### Error: "Transaction reverted"
- Revisa la consola del navegador (F12) para más detalles
- Verifica que los contratos estén deployados
- Verifica que estés usando el Context ID correcto

---

## 🎯 Puntos Clave para la Demo

1. **Privacidad:** La identidad se genera localmente, nunca se comparte
2. **ZK Proof:** Se genera en el browser, demuestra membresía sin revelar identidad
3. **On-Chain Verification:** El smart contract verifica el proof criptográficamente
4. **Double-Spending Prevention:** El nullifier previene uso duplicado

---

## 📸 Para Screenshots/Video

**Momentos clave para capturar:**
- ✅ Wallet conectado
- ✅ Evento creado
- ✅ Identidad generada (mostrar que es local)
- ✅ Proof generándose (mostrar el tiempo)
- ✅ Proof verificado on-chain
- ✅ Intento de duplicado (mostrar error)

---

¡Listo para la demo! 🚀

