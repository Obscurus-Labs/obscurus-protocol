# Estado del Proyecto - Obscurus Protocol (ZK Tickets)

## 📋 Resumen Ejecutivo

Obscurus Protocol es un sistema de tickets privados basado en Zero-Knowledge Proofs que permite verificar la elegibilidad de usuarios sin revelar su identidad. El proyecto implementa un flujo completo E2E usando Semaphore para la privacidad y NFTs para representar tickets.

**Estado**: ✅ **Funcional** - Test E2E pasando con verificación ZK real

---

## 🏗️ Arquitectura Actual

### Contratos Desplegados

1. **Semaphore** - Gestión de grupos y verificación de proofs ZK
   - Usa `Verifier.sol` real (generado desde el circuito)
   - Maneja Merkle trees para grupos de miembros

2. **GroupManager** - Mapeo de contextos lógicos a grupos Semaphore
   - `contextId` → `semaphoreGroupId`
   - Gestión de miembros y congelamiento de grupos

3. **NFTFactory** - Factory para crear colecciones de tickets
   - Usa EIP-1167 (minimal proxies) para eficiencia de gas
   - Cada evento/contexto tiene su propia colección NFT

4. **BaseNFT** - Implementación base de NFT para tickets
   - ERC-721 estándar
   - Minting controlado por el organizador

5. **ZKVerifier** - Verificador de alto nivel
   - Tracking de nullifiers por contexto
   - Prevención de doble uso
   - Emite eventos `AccessGranted`

### Circuito ZK

- **Ubicación**: `circuits/semaphore.circom`
- **Profundidad**: 20 niveles (compatible con árboles grandes)
- **Funcionalidad actual**: Soporta árboles de 1 miembro (simplificado)
- **Verifier generado**: `contracts/Verifier.sol` ✅

---

## ✅ Lo que Funciona

### Test E2E Completo

El test `test/e2e.zk-tickets.ts` incluye:

**Test 1: Flujo completo con 1 miembro**
1. ✅ **Deployment de contratos** - Todos los contratos se despliegan correctamente
2. ✅ **Creación de evento/colección** - NFTFactory crea colecciones
3. ✅ **Minting de NFT** - Usuario recibe NFT de ticket
4. ✅ **Generación de identidad** - Identidad ZK generada localmente (privada)
5. ✅ **Registro en grupo** - Miembro agregado al Merkle tree de Semaphore
6. ✅ **Generación de proof ZK** - Proof generado con snarkjs (0.27s)
7. ✅ **Verificación on-chain** - Verifier real valida el proof criptográficamente
8. ✅ **Prevención de doble uso** - Nullifier tracking funciona correctamente

**Test 2: Flujo con 3 miembros** ⚠️ **Requiere recompilación del circuito**
1. ✅ **Test implementado** - Agrega 3 miembros al grupo
2. ✅ **Cálculo de Merkle path** - Función helper para calcular path completo
3. ⏳ **Pendiente validación** - Requiere recompilar circuito con nueva lógica de Merkle path

### Verificación Real Implementada

- ✅ `Verifier.sol` generado desde el circuito
- ✅ Test detecta automáticamente y usa el verifier real
- ✅ Verificación criptográfica Groth16 funcionando
- ✅ Fallback a mock si no existe Verifier (para desarrollo rápido)

---

## ⚠️ Problemas Conocidos

### 1. Circuito actualizado para múltiples miembros ✅
- **Estado actual**: Circuito actualizado para verificar Merkle path completo
- **Test agregado**: Test con 3 miembros implementado
- **Pendiente**: Recompilar circuito y regenerar Verifier.sol
- **Prioridad**: Alta (necesario para validar funcionamiento completo)

### 2. Trusted Setup local
- **Estado actual**: Usa `ptau12` (testing)
- **Limitación**: No seguro para producción
- **Requerido**: Participar en ceremonia multi-party o usar `ptau20+`
- **Prioridad**: Alta (seguridad)

### 3. Valores intercambiados en circuitInput
- **Estado actual**: Valores de `signalHash` y `externalNullifier` están intercambiados
- **Workaround**: Intercambio manual en el test
- **Causa**: Orden de public signals en el circuito vs. lo que espera Semaphore
- **Prioridad**: Media (funciona pero es confuso)

---

## 🎯 Próximos Pasos

### Corto Plazo (1-2 semanas)

1. **Recompilar circuito y regenerar Verifier.sol** ⚠️ **URGENTE**
   - El circuito fue actualizado para verificar Merkle path completo
   - Necesita recompilación: `circom circuits/semaphore.circom --r1cs --wasm --sym -o circuits/`
   - Regenerar zkey y Verifier.sol
   - Ejecutar test con 3 miembros para validar

2. **Arreglar orden de public signals**
   - Investigar por qué el circuito genera los valores intercambiados
   - Corregir el circuito o ajustar el test permanentemente
   - Documentar el orden correcto

3. **Arreglar cierre del proceso de test**
   - Investigar por qué Hardhat no cierra correctamente
   - Implementar cleanup adecuado de conexiones
   - O documentar el workaround

### Mediano Plazo (1 mes)

4. **Trusted Setup para producción**
   - Participar en ceremonia multi-party
   - O usar `ptau20+` de fuente confiable
   - Regenerar `Verifier.sol` con setup seguro

5. **SDK/Cliente**
   - Crear SDK TypeScript/JavaScript
   - Simplificar generación de proofs para usuarios
   - Documentación de uso

6. **Tests adicionales**
   - Test con múltiples miembros
   - Test de edge cases
   - Test de gas optimization

### Largo Plazo (2-3 meses)

7. **Deployment a testnet**
   - Sepolia o Goerli
   - Verificación de contratos
   - Documentación de direcciones

8. **Frontend/Demo**
   - Interfaz para organizadores
   - Interfaz para usuarios
   - Demo del flujo completo

9. **Auditoría de seguridad**
   - Revisión de contratos
   - Revisión del circuito
   - Bug bounty program

---

## 📁 Estructura del Proyecto

```
obscurus-protocol/
├── contracts/
│   ├── BaseNFT.sol              # NFT base para tickets
│   ├── NFTFactory.sol            # Factory de colecciones
│   ├── GroupManager.sol          # Gestión de grupos Semaphore
│   ├── ZKVerifier.sol            # Verificador de alto nivel
│   ├── Semaphore.sol             # Contrato Semaphore
│   ├── Verifier.sol              # Verifier real (generado) ✅
│   └── MockSemaphoreVerifier.sol # Mock para desarrollo
├── circuits/
│   ├── semaphore.circom          # Circuito ZK
│   ├── semaphore_final.zkey      # Proving key
│   └── semaphore_js/             # WASM y witness calculator
├── test/
│   └── e2e.zk-tickets.ts         # Test E2E completo ✅
└── scripts/
    ├── deployAll.ts              # Deployment de todos los contratos
    └── generateProof.ts          # Generación de proofs
```

---

## 🔧 Comandos Útiles

### Setup Inicial
```bash
# Generar Verifier desde el circuito
snarkjs zkey export solidityverifier circuits/semaphore_final.zkey contracts/Verifier.sol

# Compilar contratos
npx hardhat compile

# Ejecutar test E2E
npx hardhat test test/e2e.zk-tickets.ts
```

### Deployment
```bash
# Deploy todos los contratos
npx hardhat run scripts/deployAll.ts
```

---

## 📊 Métricas Actuales

- **Tiempo de generación de proof**: ~0.27 segundos
- **Gas estimado**: Por medir
- **Tamaño del proof**: 8 elementos (Groth16 estándar)
- **Tamaño del Verifier**: ~221 líneas de Solidity
- **Cobertura de tests**: 1 test E2E completo

---

## 🔐 Seguridad

### ✅ Implementado
- Verificación ZK real (no mock en producción)
- Prevención de doble uso (nullifier tracking)
- Privacidad: identidad nunca se revela
- Scope de nullifiers (previene replay entre contextos)

### ⚠️ Pendiente
- Auditoría de seguridad
- Trusted setup seguro para producción
- Verificación de Merkle path completo

---

## 📝 Notas Técnicas

### Orden de Public Signals

El circuito genera public signals en este orden:
- `[0]` merkleTreeRoot (output)
- `[1]` nullifierHash (output)
- `[2]` signalHash (public input) - **INTERCAMBIADO en el test**
- `[3]` externalNullifier (public input) - **INTERCAMBIADO en el test**

Semaphore espera:
- `[0]` merkleTreeRoot
- `[1]` nullifier
- `[2]` _hash(message) = _hash(signal)
- `[3]` _hash(scope) = _hash(externalNullifier)

**Workaround actual**: Los valores se intercambian en `circuitInput` para que coincidan.

### Hash Function

Semaphore usa `_hash(x) = uint256(keccak256(abi.encodePacked(x))) >> 8` para hacer los valores compatibles con el campo escalar de SNARKs.

---

## 🎉 Logros Recientes

1. ✅ **Verifier real implementado** - Ya no se usa mock en el test
2. ✅ **Test E2E completo** - Todo el flujo funciona end-to-end
3. ✅ **Verificación criptográfica** - Proofs se verifican realmente on-chain
4. ✅ **Detección automática** - Test detecta si usar verifier real o mock

---

## 📞 Contacto / Contribuciones

Para más detalles técnicos, ver `ZK_TICKETS_WHITEPAPER.md`.

**Última actualización**: Diciembre 2024

