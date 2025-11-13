declare module 'snarkjs' {
  export const groth16: {
    fullProve(
      input: any,
      wasmPath: string | Uint8Array,
      zkeyPath: string | Uint8Array
    ): Promise<{ proof: any; publicSignals: string[] }>;
    exportSolidityCallData(proof: any, publicSignals: string[]): Promise<string> | string;
  };
}

