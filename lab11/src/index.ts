import { ExportWrapper, compileModule } from "../../lab09";
import { parseFunnier } from "../../lab10";
import { verifyModule } from "./verifier";

export async function parseVerifyAndCompile(nameOrSource: string, maybeSource?: string): 
Promise<Record<string, Function>> {
    const source = (typeof maybeSource === "string") ? maybeSource : nameOrSource;
    const origin = (typeof maybeSource === "string") ? nameOrSource : undefined;

    const ast = (parseFunnier as any)(source, origin);

    await verifyModule(ast);
    const mod = await compileModule(ast);
    return new ExportWrapper(mod);
}