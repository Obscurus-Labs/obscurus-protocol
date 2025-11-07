import { ethers, keccak256, toUtf8Bytes } from "ethers";
import { groth16 } from "snarkjs";

import * as fs from "node:fs";
import * as path from "node:path";

async function main() {
  //
  // 1) CONFIG QUE VAS A CAMBIAR
  //
  const contextId = 1n; // tu “evento” o grupo lógico
  const signal = 1n; // podés usar 1, o el ticketType
  const zkVerifierAddress = "0xYourZKVerifier"; // poné la address real
  const merkleRoot = "0x1234..."; // root que congelaste / leíste del contrato
  const identitySecret = {
    // esto en producción viene del wallet / app
    trapdoor: 123456789n,
    nullifier: 987654321n,
  };

  //
  // 2) ARMAR EL EXTERNAL NULLIFIER IGUAL AL CONTRATO
  //
  // abi.encodePacked("ZK_CTX", address(this), contextId)
  const encoded = ethers.concat([
    toUtf8Bytes("ZK_CTX"),
    ethers.getAddress(zkVerifierAddress),
    ethers.zeroPadValue(ethers.toBeHex(contextId), 32),
  ]);
  const externalNullifier = BigInt(keccak256(encoded));

  //
  // 3) ARMAR LA IDENTITY COMO EN SEMAPHORE
  // identityCommitment = poseidon([trapdoor, nullifier])
  // acá lo mockeamos, porque esto lo suele hacer el client/lib de semaphore
  //
  // IMPORTANTE: el circuito de semaphore espera ciertos nombres de input.
  // Para simplificar, vamos a usar los nombres estándar:
  //
  // {
  //   identity_nullifier,
  //   identity_trapdoor,
  //   merkle_root,
  //   external_nullifier,
  //   signal,
  //   path_elements,
  //   path_index
  // }
  //
  // Como no estamos conectando todavía al árbol real, vamos a poner un path vacío
  // y suponer que somos la hoja 0.
  //

  const input = {
    identity_nullifier: identitySecret.nullifier.toString(),
    identity_trapdoor: identitySecret.trapdoor.toString(),
    merkle_root: BigInt(merkleRoot).toString(),
    external_nullifier: externalNullifier.toString(),
    signal: signal.toString(),
    // estos dos dependen del árbol real; para testear circuito podés dejar arrays vacíos
    path_elements: [] as string[],
    path_index: [] as string[],
  };

  //
  // 4) CARGAR WASM + ZKEY Y GENERAR PRUEBA
  //
  const wasmPath = path.join(__dirname, "..", "circuits", "semaphore.wasm");
  const zkeyPath = path.join(
    __dirname,
    "..",
    "circuits",
    "semaphore_final.zkey"
  );

  if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
    throw new Error("WASM or zkey not found. Check paths.");
  }

  const { proof, publicSignals } = await groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );

  //
  // 5) FORMATEAR LA PRUEBA COMO LA ESPERA EL CONTRATO
  //
  // Semaphore usa Groth16 (a, b, c) → el contrato espera [8] uint256
  // snarkjs tiene un helper para eso:
  const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
  // calldata es un string tipo: "[a,b] [[b],[b]] [c] [pub1,pub2,...]"

  // parsearlo
  const argv = calldata
    .replace(/["[\]\s]/g, "")
    .split(",")
    .map((x: string) => BigInt(x));

  // los primeros 8 son la proof (a, b, c)
  const proofArray = [
    argv[0],
    argv[1],
    argv[2],
    argv[3],
    argv[4],
    argv[5],
    argv[6],
    argv[7],
  ];

  // publicSignals suele incluir: merkleRoot, nullifierHash, signal, externalNullifier...
  // depende del circuito que uses. Acá imprimimos todo para ver:
  console.log("publicSignals:", publicSignals);
  console.log("proofArray:", proofArray);

  // guardamos a un json para usarlo en el test / script de hardhat
  const out = {
    contextId: contextId.toString(),
    signal: signal.toString(),
    proof: proofArray.map((x) => x.toString()),
    publicSignals,
  };

  fs.writeFileSync(
    path.join(__dirname, "..", "proof-output.json"),
    JSON.stringify(out, null, 2)
  );

  console.log("✅ proof-output.json generated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
