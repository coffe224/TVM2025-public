import { writeFileSync } from "fs";
import { Op, I32, Void, c, BufferedEmitter, LocalEntry, ValueType, FuncType, ExportEntry, VarUint32, FunctionBody, Int} from "../../wasm";
import { Module, ParameterDef, Statement, Expr, FuncCallExpr, LValue, Condition, ArrAccessExpr, ArrLValue } from "../../lab08";

const { i32, 
    varuint32,
    get_local, local_entry, set_local, call, if_, void_block, void_loop, br_if, str_ascii, export_entry,
    func_type_m, function_body, type_section, function_section, export_section, code_section } = c;
  
export async function compileModule<M extends Module>(m: M, name?: string): Promise<WebAssembly.Exports>
{
    const wasmModule = convertToWasmModule(m);
    const emitter = new BufferedEmitter(new ArrayBuffer(wasmModule.z));
    wasmModule.emit(emitter);
    const wasm = await WebAssembly.instantiate(emitter.buffer);
    return wasm.instance.exports;
}

function convertToWasmModule(m : Module) : any {
    const funcIndeces = new Map<string, number>;  
    
    const funcTypes: FuncType[] = [];
    const wasmFuncBodies: FunctionBody[] = [];
    const functionEntries: VarUint32[] = [];
    const exportEntries: ExportEntry[] = [];
    
    for (let i = 0; i < m.functions.length; i++) {
        const func = m.functions[i];
        funcIndeces.set(func.name, i);

        const paramTypes = func.parameters.map((e) => i32);
        const retTypes = func.returns.map((e) => i32);

        funcTypes.push(func_type_m(paramTypes, retTypes));
        functionEntries.push(varuint32(i)); 
        exportEntries.push(export_entry(str_ascii(func.name), c.external_kind.function, varuint32(i)));
    
        const retNames = func.returns.map((e) => e.name);
        const paramNames = func.parameters.map((e) => e.name);
        const localNames = func.locals.map((e) => e.name);
        const wasmLocals = [...paramNames, ...retNames, ...localNames];

        const localIndeces = new Map<string, number>;
        wasmLocals.map((name, ind) => localIndeces.set(name, ind));

        const localEntries = [local_entry(varuint32(wasmLocals.length), i32)]; 

        const bodyInstr = compileStmt(func.body, localIndeces, funcIndeces) as (Op<I32> | Op<Void>)[];

        for (const r of func.returns) {
            const idx = localIndeces.get(r.name)!;
            bodyInstr.push(get_local(i32, idx));
        }

        wasmFuncBodies.push(function_body(localEntries, bodyInstr));
    }   

    return c.module([
        type_section(funcTypes),
        function_section(functionEntries),
        export_section(exportEntries),
        code_section(wasmFuncBodies),
    ]);
}

function compileStmt(stmt : Statement, localIndeces : Map<string, number>, funcIndeces : Map<string, number>) : Op<Void>[] {
    const ops = [] as Op<Void>[];

    switch(stmt.type) {
        case "blk":
        
        for(const s of stmt.stmts) {
            ops.push(...compileStmt(s, localIndeces, funcIndeces));
        }
        break;
        
        case "assign":
        
        const right : Op<I32>[] = stmt.right.map(e => compileExpr(e, localIndeces, funcIndeces));
        for (let i = stmt.right.length - 1; i >= 0; i--) {
            const left = stmt.left[i];
            const lvalue = compileLval(left, localIndeces, funcIndeces);
            ops.push(lvalue.set(right[i]));
        }
        break;

        case "if": {
            const cond = compileCondition(stmt.condition, localIndeces, funcIndeces);
            const thenSt = compileStmt(stmt.then, localIndeces, funcIndeces);
            const elseSt = stmt.else != null ? compileStmt(stmt.else, localIndeces, funcIndeces) : [];
            ops.push(c.void_block([c.if_(
                c.void, 
                cond,
                thenSt,
                elseSt
            )]));
            break;
        }

        case "while": {
            const cond = compileCondition(stmt.condition, localIndeces, funcIndeces);
            const body = compileStmt(stmt.body, localIndeces, funcIndeces);
            // const invariant needs to be added.

            const whileLoop = 
            c.void_block([
                c.void_loop([
                    c.br_if(1, i32.eqz(cond)),
                    ...body,
                    c.br(0)
                ])
            ]);
            
            ops.push(whileLoop);
            break;
        }
    }
    return ops;
}

function compileExpr(e : Expr, localIndeces : Map<string, number>, funcIndeces : Map<string, number>) : Op<I32> {
    switch (e.type) {
        case "num":
            const num = e as Num;
            return i32.const(parseInt(num.value));

        case "var": 
            const v = e as Var;
            const index = getLocalIndex(localIndeces, v.name);
            return get_local(i32, index);

        case "unmin":
            const n = e as UnMin;
            return i32.sub(i32.const(0), compileExpr(n.arg, localIndeces, funcIndeces));

        case "bin": {
            const b = e as Bin;
            const left = compileExpr(b.arg0, localIndeces, funcIndeces);
            const right = compileExpr(b.arg1, localIndeces, funcIndeces);
            switch (b.op) {
                case "+": return i32.add(left, right);
                case "-": return i32.sub(left, right);
                case "*": return i32.mul(left, right);
                case "/": return i32.div_s(left, right);
                default:
                    throw new Error(`Unknown binary operator ${b.op}`);
            }
        }

        case "funccall":
            const func = e as FuncCallExpr;
            const args = func.args.map(arg => compileExpr(arg, localIndeces, funcIndeces));
            const funcIndex = funcIndeces.get(func.name);
            if (funcIndex === undefined) {
                throw new WebAssembly.RuntimeError(`Unknown function: ${func.name}`);
            }
            return call(i32, varuint32(funcIndex), args);

        case "arraccess": {
            const ae = e as ArrAccessExpr;
            const index = localIndeces.get(ae.name);
            if (index === undefined)
                throw new Error(`Index not found for ${ae.name}`);

            const indexExpr = compileExpr(ae.index, localIndeces, funcIndeces);
            const baseAddress = c.get_local(i32, index);
            
            const elementOffset = i32.mul(indexExpr, i32.const(4));
            const elementAddress = i32.add(baseAddress, elementOffset);
            
            return i32.load(
                [varuint32(4), 0 as any as Int],
                elementAddress,
            );
        }

        default:
             throw new Error(`Unknown expression node ${e.type}`);
    }
}

function compileLval(lv : LValue, localIndeces : Map<string, number>, funcIndeces : Map<string, number>) : {set: (value: Op<I32>) => Op<Void>} {
    switch (lv.type) {
        case "lsingvar": {
            const index = localIndeces.get(lv.name);
            if (index === undefined)
                throw new Error(`Index not found for ${lv.name}`);
            return {
                set: (value: Op<I32>) => c.set_local(index, value),
            };
        }
        case "larr":
            const index = localIndeces.get(lv.name);
            if (index === undefined)
                throw new Error(`Index not found for ${lv.name} array`);
            const indexExpr = compileExpr(lv.index, localIndeces, funcIndeces);
            const baseAddress = c.get_local(i32, index);
            
            const elementOffset = i32.mul(indexExpr, i32.const(4));
            const elementAddress = i32.add(baseAddress, elementOffset);

            return {
                set: (value: Op<I32>) => {
                    return i32.store(  
                        // flags - a bitfield which currently contains the alignment in the least
                        // significant bits, encoded as log2(alignment)
                        // --
                        // offset - added to the address to form effective address.
                        // Useful when the address is dynamic and the compiler wants to add some
                        // constant amount of offset to the dynamically-produced address.
                        // I.e. effective_address = address + offset
                        [varuint32(4), 0 as any as Int],
                        elementAddress,
                        value
                    );
                }
            };
        default:
            const _never: never = lv as never;
            throw new Error(`Unknown lvalue node ${(_never as any).type}`);;
        }
}

function compileCondition(cd : Condition, localIndeces : Map<string, number>, funcIndeces : Map<string, number>) : Op<I32> {
    switch (cd.type) {
        case "comp" :{
            const left = compileExpr(cd.left, localIndeces, funcIndeces);
            const right = compileExpr(cd.right, localIndeces, funcIndeces);
            switch (cd.op) {
                case "==":
                    return i32.eq(left, right);
                case "!=":
                    return i32.ne(left, right);
                case ">":
                    return i32.gt_s(left, right);
                case "<":
                    return i32.lt_s(left, right);
                case ">=":
                    return i32.ge_s(left, right);
                case "<=":
                    return i32.le_s(left, right);
                default:
                    const _never: never = cd as never;
                    throw new Error(`Unsupported comparison op${(_never as any).op}`);
            }
        }
        case "and" : {
            return c.if_(
                i32, 
                compileCondition(cd.left, localIndeces, funcIndeces),
                [compileCondition(cd.right, localIndeces, funcIndeces)],
                [i32.const(0)]
            );
        }
        case "or" : {
            return c.if_(
                i32, 
                compileCondition(cd.left, localIndeces, funcIndeces),
                [i32.const(1)],
                [compileCondition(cd.right, localIndeces, funcIndeces)],
            );
        }
        case "impl" : {
            // actually cannot occur since all implications 
            // are converted to 'or' during funny parsing.
            const _never: never = cd as never;
            throw new Error(`Implications do not exist ${(_never as any).type}`);
            break;
        }
        case "true" : {
            return i32.const(1);
        }
        case "false" : {
            return i32.const(0);
        }
        case "not" : {
            return i32.eqz(compileCondition(cd.condition, localIndeces, funcIndeces));
        }
        case "paren" : {
            return compileCondition(cd.inner, localIndeces, funcIndeces);
        }
        default :
            const _never: never = cd as never;
            throw new Error(`Unknown lvalue node ${(_never as any).type}`);
    }
}

function getLocalIndex(localIndeces : Map<string, number>, name: string): number {
    const idx = localIndeces.get(name);
    if (idx === undefined) {
        throw new WebAssembly.RuntimeError(`Unknown variable: ${name}`);
    }
    return idx;
}

export { FunnyError } from '../../lab08'