import { c as C, Op, I32 } from "@tvm/wasm";
import { Expr } from "@tvm/lab04";
import { buildOneFunctionModule, Fn } from "./emitHelper";
const { i32, get_local} = C;
    

export function getVariables(e: Expr): string[] {
    const set = new Set<string>;
    function findVariables(e: Expr): void {
        switch (e.type) {
            case 'variable':
                set.add(e.value); break;

            case 'number':
                break;

            case 'unary_min':
                findVariables(e.arg); break;

            case 'add_op':
            case 'sub_op':
            case 'mul_op':
            case 'div_op':
                findVariables(e.left_arg);
                findVariables(e.right_arg); break;
            }
    }
    findVariables(e);
    return [...set];
}


export async function buildFunction(e: Expr, variables: string[]): Promise<Fn<number>>
{
    let expr = wasm(e, variables)
    return await buildOneFunctionModule("test", variables.length, [expr]);
}

function wasm(e: Expr, args: string[]): Op<I32> {
    switch (e.type) {
        case 'number':
            return i32.const(e.value);

        case 'variable':
            const index = args.indexOf(e.value);
            return get_local(i32, index);

        case 'unary_min':
            return i32.sub(i32.const(0), wasm(e.arg, args));

        case 'add_op':
            return i32.add(wasm(e.left_arg, args), wasm(e.right_arg, args))
        
        case 'sub_op':
            return i32.sub(wasm(e.left_arg, args), wasm(e.right_arg, args))

        case 'mul_op':
            return i32.mul(wasm(e.left_arg, args), wasm(e.right_arg, args))

        case 'div_op':
            return i32.div_s(wasm(e.left_arg, args), wasm(e.right_arg, args))
    }
}
