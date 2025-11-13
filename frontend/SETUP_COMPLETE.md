# ✅ Frontend Setup Completo

## 🎉 Estado: LISTO PARA USAR

El frontend ha sido configurado completamente y está listo para ejecutarse.

### ✅ Completado:

1. ✅ **Dependencias instaladas** - Todas las dependencias de npm instaladas
2. ✅ **Archivos de circuitos copiados** - `semaphore.wasm` y `semaphore_final.zkey` en `public/circuits/`
3. ✅ **Build exitoso** - El proyecto compila sin errores
4. ✅ **Tipos TypeScript** - Declaraciones de tipos para circomlibjs y snarkjs
5. ✅ **Configuración completa** - Next.js, wagmi, RainbowKit configurados

---

## 🚀 Cómo Ejecutar

### Paso 1: Iniciar Hardhat Local Node

```bash
# Terminal 1 - Desde la raíz del proyecto
npx hardhat node
```

### Paso 2: Deployar Contratos

```bash
# Terminal 2 - Desde la raíz del proyecto
npx hardhat run scripts/deployAll.ts --network localhost
```

**Nota:** Las direcciones por defecto en `frontend/lib/contracts.ts` deberían coincidir con Hardhat local. Si no, actualiza el archivo.

### Paso 3: Iniciar Frontend

```bash
# Terminal 3
cd frontend
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 📋 Flujo de Uso

1. **Conectar Wallet** - Click en "Connect Wallet" (arriba a la derecha)
2. **Crear Evento** - Ingresa Context ID (ej: 1) y nombre del evento, click "Create Event"
3. **Generar Identidad** - Click "Generate Identity" (se genera localmente, nunca se comparte)
4. **Agregar al Grupo** - Ingresa ticket type (ej: 1), click "Add to Group"
5. **Congelar Grupo** - Click "Freeze Group" (necesario antes de generar proofs)
6. **Generar Proof** - Click "Generate Proof" (puede tomar 10-30 segundos)
7. **Verificar** - Click "Verify Proof" para verificar on-chain

---

## 🔧 Configuración de MetaMask

Para usar Hardhat local network en MetaMask:

1. Abre MetaMask
2. Settings → Networks → Add Network
3. Configuración:
   - **Network Name:** Hardhat Local
   - **RPC URL:** http://localhost:8545
   - **Chain ID:** 31337
   - **Currency Symbol:** ETH

---

## 📁 Archivos Importantes

- `frontend/lib/contracts.ts` - Direcciones y ABIs de contratos
- `frontend/lib/zk.ts` - Utilidades para ZK proofs
- `frontend/public/circuits/` - Archivos de circuitos (WASM y zkey)

---

## ⚠️ Troubleshooting

### Error: "Circuit files not found"
- Verifica que `public/circuits/semaphore.wasm` y `public/circuits/semaphore_final.zkey` existan

### Error: "Contract not found"
- Verifica que Hardhat node esté corriendo
- Verifica que los contratos estén deployados
- Revisa las direcciones en `lib/contracts.ts`

### Error: "Network not found"
- Agrega Hardhat network a MetaMask (ver arriba)
- O cambia a Sepolia/Optimism Sepolia en el selector de red

---

## 🎯 Listo para Demo!

El frontend está completamente funcional y listo para:
- ✅ Demo en vivo
- ✅ Screenshots
- ✅ Video/GIF
- ✅ Presentación

¡Todo listo! 🚀


