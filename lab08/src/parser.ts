import { getExprAst } from '../../lab04';
import * as ast from './funny';
import { FunnyError } from '.';
import grammar, { FunnyActionDict } from './funny.ohm-bundle';
import { Interval, MatchResult, Node, Semantics } from 'ohm-js';


export function intervalToLoc(interval: any): ast.Location | undefined {
    if (!interval) return undefined;

    const startIdx = typeof interval.startIdx === "number" ? interval.startIdx : undefined;
    const endIdx = typeof interval.endIdx === "number" ? interval.endIdx : undefined;
    const src = interval.sourceString ?? (interval.inputString ?? undefined);
    if (typeof startIdx !== "number" || typeof endIdx !== "number" || typeof src !== "string") {
        return undefined;
    }

    function indexToLineCol(idx: number) {
        const before = src.slice(0, idx);
        const lines = before.split("\n");
        const line = lines.length;
        const col = lines[lines.length - 1].length + 1;
        return {line, col};
    }

    const s = indexToLineCol(startIdx);
    const e = indexToLineCol(endIdx);
    return {
        startLine: s.line, startCol: s.col,
        endLine: e.line, endCol: e.col
    } as ast.Location;
}

export function checkUniqueNames(items: ast.ParameterDef[] | ast.ParameterDef, kind: string) {
    const itemArray = Array.isArray(items) ? items : [items];
    const nameMap = new Map<string, number>();
    
    itemArray.forEach((item, idx) => {
        if (!item || typeof item.name !== "string") {
            throw new Error("checkUniqueNames: undefined name");
        }
        if (nameMap.has(item.name)) {
            throw new Error(`redeclaration of ${kind} '${item.name}' at position ${idx}`);
        }
        nameMap.set(item.name, idx);
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
        case "block":
            if (Array.isArray(node.stmts)) {
                node.stmts.forEach((stmt: any) => collectNamesInNode(stmt, out));
            }
            break;
        case "assign":
            if (Array.isArray(node.targets)) {
                node.targets.forEach((target: any) => collectNamesInNode(target, out));
            }
            if (Array.isArray(node.exprs)) {
                node.exprs.forEach((expr: any) => collectNamesInNode(expr, out));
            }
            break;
        case "lvar":
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

        case "variable":
            out.add(node.value);
            break;
        case "add_op":
        case "sub_op":
        case "div_op":
        case "mul_op":
            collectNamesInNode(node.left_arg, out);
            collectNamesInNode(node.right_arg, out);
            break;
        case "funccallstmt": 
            collectNamesInNode(node.call, out);
            break;
        case "number":
            break;
    }
}

function checkFunctionCalls(module: ast.Module) {
    const functionTable = new Map<string, { params: number, returns: number }>();
    for (const func of module.functions) {
        functionTable.set(func.name, { 
            params: func.parameters.length, 
            returns: func.returns.length 
        });
    }

    function visitNode(node: any, context: { expectedReturns?: number } = {}) {
        if (!node) return;

        if (node.type === "funccall") {
            const funcName = node.name;
            const argCount = node.args.length;

            if (!functionTable.has(funcName)) {
                throw new Error(`function ${funcName} is not declared`);
            }
            
            const funcInfo = functionTable.get(funcName)!;

            const expectedArgCount = funcInfo.params;
            if (argCount !== expectedArgCount) {
                throw new Error();
            }

            const returnsCount = funcInfo.returns;
            const expectedReturns = context.expectedReturns;
            if (returnsCount !== expectedReturns) {
                throw new Error();
            }

            if (Array.isArray(node.args)) {
                for (const arg of node.args) {
                    visitNode(arg, { expectedReturns: 1 });
                }
            }

            return;
        } else if (node.type === "block") {
            if (Array.isArray(node.stmts)) {
                node.stmts.forEach((stmt: any) => visitNode(stmt));
            }
        } else if (node.type === "assign") {
            if (Array.isArray(node.exprs)) {
                const targetsReturns = node.targets.length;
                if (Array.isArray(node.exprs)) {
                    node.exprs.forEach((expr: any) => visitNode(expr, { expectedReturns: targetsReturns }));
                }
            }
        }
    }

    for (const func of module.functions) {
        visitNode(func.body);
    }
}

export const getFunnyAst = {
    ...getExprAst,

    Module(funcs) {
        const functions = funcs.children.map((x: any) => x.parse());
        return { type: "module", functions: functions } as ast.Module;
    },
    Param(name, colon, type: any) {
        let paramName = name.sourceString;
        const typeAst = type.parse();
        const varType = typeAst && typeAst.isArray ? "int[]" : "int";
        return {type: "param", name: paramName, varType: varType} as ast.ParameterDef;
    },
    ParamList(list) {
        const params = list.asIteration().children.map((c: any) => c.parse());
        checkUniqueNames(params, "parameter");
        return params;
    },
    ParamListNonEmpty(list) {
        const params = list.asIteration().children.map((c: any) => c.parse());
        checkUniqueNames(params, "parameter");
        return params;
    },
    Preopt(requires_str, predicate) {
        const p = predicate.parse();
        const loc = intervalToLoc(predicate.source);
        if (p && typeof p === "object") (p as any).loc = loc;
        return p;
    },
    UsesOpt(uses_str, paramsNode) {
        const params = paramsNode.asIteration().children.map((c: any) => c.parse());
        return params;
    },
    Function(var_name, left_paren, params_opt, right_paren, preopt, returns_str, returns_list, usesopt, statement: any) {
        const func_name = var_name.sourceString;
        const arr_func_parameters = params_opt.asIteration().children.map(x => x.parse() as ast.ParameterDef);
        const preopt_ast = preopt.parse ? preopt : null;
        const arr_return_array = returns_list.asIteration().children.map(x => x.parse()) as ast.ParameterDef[];        
        const arr_locals_array = usesopt.children.length > 0
        ? usesopt.children[0].children[1].asIteration().children.map((x: any) => x.parse()) as ast.ParameterDef[]
        : [];

        if (arr_func_parameters.length !== 0) {
            checkUniqueNames(arr_func_parameters, "parameter");
        }
        if (arr_return_array.length !== 0) {
            checkUniqueNames(arr_return_array, "return value");
        }
        if (arr_locals_array.length !== 0) {
            checkUniqueNames(arr_locals_array, "local variable");
        }

        const all = [...arr_func_parameters, ...arr_return_array, ...arr_locals_array];
        checkUniqueNames(all, "variable");

        const declared = new Set<string>();
        for (const i of arr_func_parameters) {
            declared.add(i.name);
        }
        for (const i of arr_return_array) {
            declared.add(i.name);
        }
        for (const i of arr_locals_array) {
            declared.add(i.name);
        }

        const used_in_body = new Set<string>();
        const parsedStatement = statement.parse() as ast.Statement;
        collectNamesInNode(parsedStatement, used_in_body);
        for (const name of used_in_body) {
            if (!declared.has(name)) {
                throw new Error("Function: локальная переменная " + name + " не объявлена");
            }
        }

        const funcLoc = intervalToLoc(this.source);

        return { type: "fun", 
            name: func_name, 
            parameters: arr_func_parameters, 
            returns: arr_return_array, 
            locals: arr_locals_array, 
            body: parsedStatement,
            loc: funcLoc} as ast.FunctionDef;
    },
    Type_int(_int) {
        return { base: "int", isArray: false };
    },
    Type_array(_int, _brackets) {
        return { base: "int", isArray: true };
    },
    Assignment_tuple_assignment(ltargertlist: any, equals, rexprlist: any, semi) {
        const targets = ltargertlist.parse();
        const exprs = rexprlist.parse();
        const loc = intervalToLoc(this.source);
        return { type: "assign", targets: targets, exprs: exprs, loc } as ast.AssignSt;
    },
    Assignment_simple_assignment(ltargert: any, equals, rexpr: any, semi) {
        const target = ltargert.parse();
        const expr = rexpr.parse();
        const loc = intervalToLoc(this.source);
        return { type: "assign", targets: [target], exprs: [expr], loc } as ast.AssignSt;
    },
    LValueList(list) {
        return list.asIteration().children.map((c: any) => c.parse());
    },
    ExprList(list) {
        return list.asIteration().children.map((c: any) => c.parse());
    },
    LValue_array_access(name, leftbracket, expr: any, rightbracket) {
        return { type: "larr", name: name.sourceString, index: expr.parse() } as ast.ArrLValue;
    },
    LValue_variable(name) {
        return { type: "lvar", name: name.sourceString } as ast.VarLValue;
    },
    Block(left_brace, statements: any, right_brace) {
        const stmts_list = statements.children.length > 0
        ? statements.children.map((c: any) => c.parse())
        : [];
        const loc = intervalToLoc(this.source);
        return { type: "block", stmts: stmts_list, loc } as ast.BlockSt;
    },
    Conditional(_if, left_paren, condition: any, right_paren, _then: any, _else, _else_statement: any) {
        const condition_parsed = condition.parse();
        let then_parsed = _then.parse();
        let else_statement = _else.children.length > 0 ? _else_statement.children[0].parse() : null;
        const loc = intervalToLoc(this.source);
        return { type: "if", condition: condition_parsed, then: then_parsed, else: else_statement, loc } as ast.ConditionalSt;
    },
    While(_while, left_paren, condition: any, right_paren, inv: any, _then: any) {
        const invariant = inv.children.length > 0 ? inv.children[0].parse() : null;
        const condition_parsed = condition.parse();
        const then_parsed = _then.parse();
        const loc = intervalToLoc(this.source);
        return { type: "while", condition: condition_parsed, invariant: invariant, body: then_parsed, loc } as ast.LoopSt;
    },
    Statement_function_call_statement(funccall: any, semi) {
        const call = funccall.parse();
        return { 
            type: "funccallstmt", 
            call: call 
        } as ast.FunctionCallSt;
    },
    InvariantOpt(_inv, predicate: any) {
        const p = predicate.parse();
        const loc = intervalToLoc(predicate.source);
        if (p && typeof p === "object") (p as any).loc = loc;
        return p;
    },
    FunctionCall(name, open_paren, arg_list, close_paren) {
        const nameStr = name.sourceString;
        const args = arg_list.children.length > 0 ? arg_list.asIteration().children.map((x: any) => x.parse()) : [];
        const loc = intervalToLoc(this.source);
        return { type: "funccall", name: nameStr, args, loc } as ast.FuncCallExpr;
    },
    ArgList(list) {
        const params = list.asIteration().children.map((c: any) => c.parse());
        return params;
    },
    ArrayAccess(name, left_bracket, expr: any, right_bracket) {
        const idx = expr.parse();
        const loc = intervalToLoc(this.source);
        return { type: "arraccess", name: name.sourceString, index: idx, loc } as ast.ArrAccessExpr;
    },
    AndOp(cond1: Node, and, cond2: Node) {
        const loc = intervalToLoc(this.source);
        return { kind: "and", left: cond1.parse(), right: cond2.parse(), loc } as ast.AndCond;
    },
    OrOp(cond1: Node, or, cond2: Node) {
        const loc = intervalToLoc(this.source);
        return { kind: "or", left: cond1.parse(), right: cond2.parse(), loc} as ast.OrCond;
    },
    NotOp(not, cond: Node) {
        const loc = intervalToLoc(this.source);
        return { kind: "not", condition: cond.parse(), loc } as ast.NotCond;
    },
    ParenOp(left_paren, cond: Node, right_paren) {
        const loc = intervalToLoc(this.source);
        return { kind: "paren", inner: cond.parse(), loc } as ast.ParenCond;
    },
    ImplyCond(first, arrows, rest: any) {
        const left = first.parse();

        if (rest && rest.children && rest.children.length > 0) {
            const rightNode = rest.children ? rest.children[0].children[1] : null;
            const right = rightNode.parse();
            const notA = { kind: "not", condition: left };
            return { kind: "or", left: notA, right };
        }

        return left;
    },
    OrCond(first, ors, rest: any) {
        let result = first.parse();

        const items = [];
        if (rest) {
            if (rest.children) {
                items.push(...rest.children);
            }
        }

        for (const item of items) {
            const rightNode = item.children ? item.children[0].children[1] : null;
            const right_parsed = rightNode.parse();
            result = { kind: "or", left: result, right: right_parsed };
        }

        return result;
    },
    AndCond(first, ands, rest: any) {
        let result = first.parse();

        const items = [];
        if (rest) {
            if (rest.children) {
                items.push(...rest.children);
            } 
        }

        for (const it of items) {
            const andNode = it.children ? it.children[1] : null;
            const right_parsed = andNode.parse();
            result = { kind: "and", left: result, right: right_parsed };
        }
        return result;
    },
    NotCond(nots: any, atom: any) {
        let result = atom.parse();
        const notsArr = [];
        if (nots) {
            if (nots.children) {
                notsArr.push(...nots.children);
            }
        }
        for (let i = 0; i < notsArr.length; ++i) {
            result = { kind: "not", condition: result };
        }
        return result;
    },
    AtomCond_true(t) {
        const loc = intervalToLoc(this.source);
        return { kind: "true", loc } as ast.TrueCond;
    },
    AtomCond_false(f) {
        const loc = intervalToLoc(this.source);
        return { kind: "false", loc } as ast.FalseCond;
    },
    AtomCond_comparison(arg0) {
        return arg0.parse();
    },
    AtomCond_paren(left_paren, cond: any, right_paren) {
        return { kind: "paren", inner: cond.parse() } as ast.ParenCond;
    },
    Comparison_eq(left_expr: any, eq, right_expr: any) {
        const left_parsed = left_expr.parse();
        const right_parsed = right_expr.parse();
        const loc_2 = intervalToLoc(this.source);
        return { kind: "comparison", left: left_parsed, op: "==", right: right_parsed, loc: loc_2 } as ast.ComparisonCond;
    },
    Comparison_neq(left_expr: any, neq, right_expr: any) {
        const left_parsed = left_expr.parse();
        const right_parsed = right_expr.parse();
        const loc_2 = intervalToLoc(this.source);
        return { kind: "comparison", left: left_parsed, op: "!=", right: right_parsed, loc: loc_2 } as ast.ComparisonCond;
    },
    Comparison_ge(left_expr: any, ge, right_expr: any) {
        const left_parsed = left_expr.parse();
        const right_parsed = right_expr.parse();
        const loc_2 = intervalToLoc(this.source);
        return { kind: "comparison", left: left_parsed, op: ">=", right: right_parsed, loc: loc_2 } as ast.ComparisonCond;
    },
    Comparison_le(left_expr: any, le, right_expr: any) {
        const left_parsed = left_expr.parse();
        const right_parsed = right_expr.parse();
        const loc_2 = intervalToLoc(this.source);
        return { kind: "comparison", left: left_parsed, op: "<=", right: right_parsed, loc: loc_2 } as ast.ComparisonCond;
    },
    Comparison_gt(left_expr: any, gt, right_expr: any) {
        const left_parsed = left_expr.parse();
        const right_parsed = right_expr.parse();
        const loc_2 = intervalToLoc(this.source);
        return { kind: "comparison", left: left_parsed, op: ">", right: right_parsed, loc: loc_2 } as ast.ComparisonCond;
    },
    Comparison_lt(left_expr: any, lt, right_expr: any) {
        const left_parsed = left_expr.parse();
        const right_parsed = right_expr.parse();
        const loc_2 = intervalToLoc(this.source);
        return { kind: "comparison", left: left_parsed, op: "<", right: right_parsed, loc: loc_2 } as ast.ComparisonCond;
    },
    ImplyPred(first, arrows, rest: any) {
        const left = first.parse();

        if (arrows.sourceString === "->") {
            const right = rest.children[0].children[1].parse();

            // A -> B === (!A) || B
            const notA = { kind: "not", predicate: left };
            return { kind: "or", left: notA, right };
        }

        return left;
    },
    OrPred(first, ors, rest: any) {
        let result = first.parse();

        const items = [];
        if (rest) {
            if (rest.children) {
                items.push(...rest.children);
            }
        }

        for (const item of items) {
            const rightNode = item.children ? item.children[0].children[1] : null;
            const right_parsed = rightNode.parse();
            result = { kind: "or", left: result, right: right_parsed };
        }

        return result;
    },
    AndPred(first, ands, rest: any) {
        let result = first.parse();

        const items = [];
        if (rest) {
            if (rest.children) {
                items.push(...rest.children);
            }
        }

        for (const it of items) {
            const andNode = it.children ? it.children[1] : null;
            const right_parsed = andNode.parse();
            result = { kind: "and", left: result, right: right_parsed };
        }

        return result;
    },
    NotPred(nots: any, atom: any) {
        let result = atom.parse();

        const notsArr = [];
        if (nots) {
            if (nots.children) {
                notsArr.push(...nots.children);
            }
        }

        for (let i = 0; i < notsArr.length; ++i) {
            result = { kind: "not", predicate: result };
        }

        return result;
    },
    AtomPred_quantifier(arg0) {
        return arg0.parse();
    },
    AtomPred_formula_ref(arg0) {
        return arg0.parse();
    },
    AtomPred_true(t) {
        return { kind: "true" };
    },
    AtomPred_false(f) {
        return { kind: "false" };
    },
    AtomPred_comparison(cmp) {
        return cmp.parse();
    },
    AtomPred_paren(left_paren, inner_pred: any, right_paren) {
        const inner = inner_pred.parse();
        const loc = intervalToLoc(this.source);
        return { kind: "paren", inner, loc } as ast.ParenPred;
    },
    Quantifier(quant, left_paren, param: any, bar, body: any, right_paren) {
        const paramAst = param.parse() as ast.ParameterDef;
        const b = body.parse();
        const loc = intervalToLoc(this.source);
        return {
            kind: "quantifier", 
            quant: quant.sourceString, 
            varName: paramAst.name, 
            varType: paramAst.varType, 
            body: b,
            loc
        } as ast.Quantifier;
    },
    FormulaRef(name, open_paren, arg_list, close_paren) {
        const nameStr = name.sourceString;
        const args = arg_list.children.length > 0 
            ? arg_list.children[0].asIteration().children.map((arg: any) => arg.parse())
            : [];
        return { kind: "formula", name: nameStr, parameters: args} as ast.FormulaRef;
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
        var interval : Interval = matchResult.getInterval();
        throw new FunnyError(
            "Syntax error", 
            interval.sourceString, 
            interval.getLineAndColumn().lineNum, 
            interval.getLineAndColumn().colNum
        );
    }

    const ast_module = semantics(matchResult).parse();
    checkFunctionCalls(ast_module);
    return ast_module;
}