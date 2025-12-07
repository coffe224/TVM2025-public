import { c as C, Op, I32 } from "@tvm/wasm";
import { Expr } from "@tvm/lab04";
import { buildOneFunctionModule, Fn } from "./emitHelper";
const { i32, get_local} = C;
    

export function getVariables(e: Expr): string[] {
    return [...new Set(findVariables(e))];
}

export function findVariables(e: Expr): string[] {
    switch (e.type) {
        case 'variable':
            return [e.value];

        case 'number':
            return [];

        case 'unary_min':
        case 'brac_expr':
            return findVariables(e.arg);

        case 'mul_op':
        case 'add_op':
            return e.args.flatMap(arg => findVariables(arg));
    }
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

        case 'brac_expr':
            return wasm(e.arg, args);

        case 'add_op':
            let add_result : Op<I32> = wasm(e.args[0], args);

            for (let i = 0; i < e.ops.length; i++) {
                if (e.ops[i] == "+") {
                    add_result = i32.add(add_result, wasm(e.args[i + 1], args));
                } else if (e.ops[i] == "-") {
                    add_result = i32.sub(add_result, wasm(e.args[i + 1], args));
                } else {
                    throw Error;
                }
            }
            return add_result;

        case 'mul_op':
            let mul_result : Op<I32> = wasm(e.args[0], args);

            for (let i = 0; i < e.ops.length; i++) {
                if (e.ops[i] == "*") {
                    mul_result = i32.mul(mul_result, wasm(e.args[i + 1], args));
                } else if (e.ops[i] == "/") {
                    mul_result = i32.div_s(mul_result, wasm(e.args[i + 1], args));
                } else {
                    throw Error;
                }
            }
            return mul_result;
    }
}
