import { getExprAst } from '../../lab04';
import * as ast from './funny';

import grammar, { FunnyActionDict } from './funny.ohm-bundle';

import { MatchResult, NonterminalNode, Semantics } from 'ohm-js';

export function collectList<T>(node: any): T[] {
    return node.asIteration().children.map((c: any) => c.parse() as T);
}


export function parseOptional<T>(node: any, ifzero: T): T {
    return node.children.length > 0
        ? (node.child(0).parse() as T)
        : ifzero;
}

export const getFunnyAst = {
    ...getExprAst,

    Module(funcs) {
        const functions = funcs.children.map((x: any) => x.parse());
        return {
            type: "module", 
            functions: functions 
        } as ast.Module;
    },
    
    VarDecl(name, _, type: any) {
        let paramName = name.sourceString;
        const typeAst = type.parse();
        return {
            type: "param", 
            name: paramName, 
            varType: typeAst, 
        } as ast.ParameterDef;
    },

    Type_int(_) {
        return { base: "int", isArray: false };
    },
    
    Type_int_arr(_) {
        return { base: "int", isArray: true };
    },

    ParameterListNotEmpty(list) {
        return collectList<ast.ParameterDef>(list);
    },
    
    ParameterList(list) {
        return collectList<ast.ParameterDef>(list);
    },
    
    ReturnList_paramlist(_, list) {
        return list.parse() as ast.ParameterDef[];
    },

    ReturnList_void(arg0, arg1) {
        return [] as ast.ParameterDef[];
    },
    
    Preopt(_, pred) {
        return pred;
    },
    
    Postopt(_, pred) {
        return pred;
    },

    Useopt(arg0, arg1) {
        return arg1.parse() as ast.ParameterDef[];
    },
    
    Function(name, left_paren, params_opt, right_paren, preopt, returns_list, postopt, useopt, statement: any) {
    const func_name = name.sourceString;
    const func_parameters: ast.ParameterDef[] = params_opt.parse();
    const return_array: ast.ParameterDef[] = returns_list.parse();

    // uses
    const locals_array: ast.ParameterDef[] = parseOptional<ast.ParameterDef[]>(useopt, []);

    const all = [...func_parameters, ...return_array, ...locals_array];
    checkUniqueNames(all, "variable");
    
    const declared = new Set<string>();
    for (const i of func_parameters) {
        declared.add(i.name);
    }
    for (const i of return_array) {
        declared.add(i.name);
    }
    for (const i of locals_array) {
        declared.add(i.name);
    }
    const used_in_body = new Set<string>();
    const parsedStatement = statement.parse() as ast.Statement;

    collectNamesInNode(parsedStatement, used_in_body);

    for (const name of used_in_body) {
        if (!declared.has(name)) {
            throw new Error("Function: local variable " + name + " is not declared");
        }
    }

    return { 
        type: "func", 
        name: func_name, 
        parameters: func_parameters, 
        returns: return_array, 
        locals: locals_array, 
        body: parsedStatement 
        } as ast.FunctionDef;
    },

    Assignment_tuple(ltargertlist: any, equals, rexpr: any, semi) {
        const targets = ltargertlist.children.map((c: any) => c.parse());
        const expr = rexpr.children.map((c: any) => c.parse());
        return { type: "assign_st", left: targets, right: expr } as ast.AssignmentSt;
    },
   
    Assignment_simple(ltargert: any, equals, rexpr: any, semi) {
        const target = ltargert.parse();
        const expr = rexpr.parse();
        return { type: "assign_st", left: [target], right: [expr] } as ast.AssignmentSt;
    },

    Assignment_array(array: any, equals, rexpr: any, semi) {
        return { type: "assign_st", left: [array.parse()], right: [rexpr.parse()] } as ast.AssignmentSt;
    },
    
    ArrayAccess(name, leftbracket, expr: any, rightbracket) {
        return { 
            type: "larr", 
            name: name.sourceString, 
            index: expr.parse() 
        } as ast.ArrLValue;
    },

    LValue(name) {
        return { 
            type: "lsingvar", 
            name: name.sourceString 
        } as ast.SingleLValue;
    },
    
    Block(left_brace, statements: any, right_brace) {
        const stmts_list = statements.children.length > 0
            ? statements.children.map((c: any) => c.parse())
            : [];
        return { type: "block_st", stmts: stmts_list } as ast.BlockSt;
    },

    Conditional(_if, left_paren, condition: any, right_paren, _then: any, _else, _else_statement: any) {
        const condition_parsed = condition.children.length > 0 ? condition.children[0].parse() : null;
        let then_parsed = _then.children.length > 0 ? _then.children[0].parse() : null;
        let else_statement = _else.children.length > 0 ? _else_statement.children[0].parse() : null;
        return { 
            type: "cond_st", 
            condition: condition_parsed, 
            then: then_parsed, 
            else: else_statement 
        } as ast.ConditionalSt;
    },

    Loop(_while, left_paren, condition: any, right_paren, inv: any, _then: any) {
        const invariant = inv.children.length > 0 ? inv.children[0].parse() : null;
        const condition_parsed = condition.children.length > 0 ? condition.children[0].parse() : null;
        const then_parsed = _then.children.length > 0 ? _then.children[0].parse() : null;
        return { 
            type: "loop_st", 
            condition: condition_parsed, 
            invariant: invariant, 
            body: then_parsed 
        } as ast.LoopSt;
    },

    Statement_expr(arg0, arg1) {
        return arg0.parse();
    },

    Invariant(_inv, predicate: any) {
        return predicate;
    },

    FunctionCall(name, open_paren, arg_list, close_paren) {
        const nameStr = name.sourceString;
        const args = arg_list.parse();
        return { 
            type: "funccall", 
            name: nameStr, 
            args: args, 
        } as ast.FuncCallExpr;
    },

    ArgumentList(list) {
        return collectList<ast.Expr>(list);
    },

    Condition_imp(left, arrow, right: any) {
        const parsedLeft = left.parse();
        const notLeft = {type: "not", condition: parsedLeft};
        return {type: "or", left: notLeft, right: right.parse()};    
    },
    
    Condition_or(left, or, right: any) {
        return {type: "or", left: left.parse(), right: right.parse()};    
    },
    
    Condition_and(left, and, right: any) {
        return {type: "and", left: left.parse(), right: right.parse()};    
    },
    
    Condition_not(not, cond: any) {
        return {type: "not", cond: cond.parse()};
    },

    Condition_true(arg0) {
        return {type: "true"};
    },
    
    Condition_false(arg0) {
        return {type: "false"};
    },
    
    Condition_comp(arg0) {
        return arg0.parse();
    },
    
    Condition_parent(arg0, arg1, arg2) {
        return arg1.parse();
    },

    Comparison(arg0, arg1, arg2: any) {
        return {
            type: "comp", 
            left: arg0.parse(), 
            op: arg1.sourceString, 
            right: arg2.parse()
        };
    },

    Predicate_or(left, or, right: any) {
       return {type: "or", left: left.parse(), right: right.parse()};
    },
    
    Predicate_and(left, or, right: any) {
       return {type: "and", left: left.parse(), right: right.parse()};
    },
    
    Predicate_not(not, right: NonterminalNode) {
       return {type: "not", right: right.parse()};
    },

    Predicate_imp(left, arrow, right: any) {
        const parsedLeft = left.parse();
        const notLeft = {type: "not", predicate: parsedLeft} as ast.Predicate;
        return {type: "or", left: notLeft, right: right.parse()} as ast.Predicate;    
    },
    
    Predicate_parent(_arg0, arg1, _arg2) {
        return arg1.parse();
    },
    
    Predicate_false(arg) {
        return {type: "false"};
    },
    
    Predicate_true(arg) {
        return {type: "true"};
    },
    
    Predicate_quant(arg0) {
        return arg0.parse();
    },
    
    Predicate_formulaRef(arg0) {
        return arg0.parse();
    },

    Quantifier(quant, left_paren, param: any, bar, body: any, right_paren) {
        const paramAst = param.parse() as ast.ParameterDef;
        return {
            type: "quantifier", 
            quant: quant.sourceString, 
            varName: paramAst.name, 
            varType: param.type, 
            body: body.parse()
        } as ast.Quantifier;
    },
    
    FormulaRef(name, open_paren, arg_list, close_paren) {
        const nameStr = name.sourceString;
        const args = arg_list.children.length > 0 
            ? arg_list.children.map((arg: any) => arg.parse())
            : [];
        return {
            type: "formula", 
            name: nameStr, 
            parameters: args
        } as ast.FormulaRef;
    },
} satisfies FunnyActionDict<any>;

export const semantics: FunnySemanticsExt = grammar.Funny.createSemantics() as FunnySemanticsExt;
semantics.addOperation("parse()", getFunnyAst);
export interface FunnySemanticsExt extends Semantics
{
    (match: MatchResult): FunnyActionsExt
}
interface FunnyActionsExt 
{
    parse(): ast.Module;
}

export function parseFunny(source: string): ast.Module
{
    const matchResult = grammar.Funny.match(source, "Module");

    if (!matchResult.succeeded()) {
        throw new SyntaxError(matchResult.message);
    }

    const ast_module = semantics(matchResult).parse();
    checkFunctionCalls(ast_module);
    return ast_module;
}

export function checkUniqueNames(params: ast.ParameterDef[], type: string) {
    if (!Array.isArray(params))
        return;

    const nameMap = new Map<string, number>();
    
    params.forEach((param, idx) => {
        if (nameMap.has(param.name)) {
            throw new Error(`redeclaration of ${type} '${param.name}' at position ${idx}`);
        }
        nameMap.set(param.name, idx);
    });
}

export function collectNamesInNode(node: any, out: Set<string>) {
    if (!node) return;

    if (Array.isArray(node)) {
        for (const elem of node) {
            collectNamesInNode(elem, out);
        }
        return;
    }

    switch (node.type) {
        case "blk":
            if (Array.isArray(node.stmts)) {
                node.stmts.forEach((stmt: any) => collectNamesInNode(stmt, out));
            }
            break;
        case "assign":
            if (Array.isArray(node.left)) {
                node.left.forEach((left: any) => collectNamesInNode(left, out));
            }
            if (Array.isArray(node.right)) {
                node.right.forEach((right: any) => collectNamesInNode(right, out));
            }
            break;
        case "lsingvar":
            if (typeof node.name === "string") {
                out.add(node.name);
            }
            break;
        case "larr":
            if (typeof node.name === "string") {
                out.add(node.name);
            }
            collectNamesInNode(node.index, out);
            break; 
        case "funccall":
            if (Array.isArray(node.args)) {
                node.args.forEach((arg: any) => collectNamesInNode(arg, out));
            }
            break;
        case "var":
            if (typeof node.name === "string") {
                out.add(node.name);
            }
            break;
        case "bin":
            collectNamesInNode(node.arg0, out);
            collectNamesInNode(node.arg1, out);
            break;
        case "num":
            break;
        case "unmin":
            collectNamesInNode(node.arg, out);
        default:
            break; 
    }
}

export function checkFunctionCalls(module: ast.Module) {
    const functionTable = new Map<string, {
        paramsCount: number, 
        returnsCount: number 
    }>();
    
    for (const func of module.functions) {
        functionTable.set(func.name, { 
            paramsCount: func.parameters.length, 
            returnsCount: func.returns.length 
        });
    }

    function visitNode(node: any, context: { expectedReturnsCount?: number } = {}) {
        if (!node) return;
        switch(node.type){
            case "funccall":
                const funcName = node.name;
                const argCount = node.args.length;

                const funcInfo = functionTable.get(funcName);
                if (!funcInfo) {
                    throw new Error(`Function ${funcName} is not declared`);
                }
                const expectedArgCount = funcInfo.paramsCount;
                if (argCount !== expectedArgCount) {
                    throw new Error(`Function ${funcName} arg mismatch`);
                }
            
                if (funcInfo.returnsCount !== context.expectedReturnsCount) {
                    throw new Error(`Function ${funcName} return mismatch`);
                }

                if (node.args.length != 0) {
                    for (const arg of node.args) {
                        visitNode(arg, { expectedReturnsCount: 1 });
                    }
                }

                break;
            case "blk":
                if (Array.isArray(node.stmts)) {
                    node.stmts.forEach((stmt: any) => visitNode(stmt));
                }
                break;
            case "assign":
                if (Array.isArray(node.right)) {
                    const leftCount = node.left.length;
                    if (Array.isArray(node.right)) {
                        node.right.forEach((expr: any) => visitNode(expr, { expectedReturnsCount: leftCount }));
                    }
                }
                break;
        }
    }

    for (const func of module.functions) {
        visitNode(func.body);
    }
}