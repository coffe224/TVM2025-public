import { Context, init, Model, Arith, Bool, Solver } from "z3-solver";
import { printFuncCall } from "./printFuncCall";
import { AnnotatedModule, AnnotatedFunctionDef } from "../../lab10";
import { Predicate, Statement, AssignSt, BlockSt, ConditionalSt, Expr, ArrAccessExpr, Condition, TrueCond, FalseCond, ComparisonCond, 
    NotCond, AndCond, OrCond, ImpliesCond, ParenCond, NotPred, AndPred, OrPred, ParenPred, ImpliesPred } from "../../lab08";
import * as ast from "../../lab04";

let z3: Context<'main'> | null = null;

async function initZ3(): Promise<Context<'main'>> {
    if (!z3) {
        const api = await init();
        z3 = api.Context("main");
    }
    return z3;
}

export function flushZ3() {
    z3 = null;
}

export async function verifyModule(module: AnnotatedModule): Promise<void> {
    const Z = await initZ3();

    for (const func of module.functions) {
        const f = func as AnnotatedFunctionDef;

        // Получаем предусловие и постусловие
        const preList: Predicate[] = f.precondition || [];
        const postList: Predicate[] = f.postcondition || [];

        // Преобразуем списки предикатов в единое условие
        const pre = combinePredicates(preList, "and");
        const post = combinePredicates(postList, "and");

        // Конвертируем Predicate в Condition для вычисления слабейшего предусловия
        const preCond = predicateToCondition(pre);
        const postCond = predicateToCondition(post);

        // Вычисляем слабейшее предусловие
        const wp = wpStatement(f.body, postCond);

        // Создаем условие верификации: pre -> wp
        const vc = implies(preCond, wp);

        // Конвертируем VC в Z3
        const env = buildIntEnvironment(Z, f);
        const theorem = condToZ3(Z, vc, env);

        // Доказываем: проверяем, является ли Not(theorem) невыполнимым
        const solver = new Z.Solver();
        solver.add(Z.Not(theorem));

        const res = await solver.check();

        if (res === "unsat") {
            // Теорема доказана - верификация успешна
            continue;
        }

        if (res === "sat") {
            const model = solver.model();
            throw new Error(
                `Верификация не удалась для функции '${f.name}'. Контрпример:\n` +
                printFuncCall(f, model)
            );
        }

        // Неизвестный результат
        throw new Error(`Верификация неоднозначна (unknown) для функции '${f.name}'.`);
    }
}

// Комбинирует список предикатов в один предикат с заданной операцией
function combinePredicates(preds: Predicate[], op: "and" | "or"): Predicate {
    if (preds.length === 0) {
        return { kind: "true" } as TrueCond;
    }
    if (preds.length === 1) {
        return preds[0];
    }

    let result: Predicate = preds[0];
    for (let i = 1; i < preds.length; i++) {
        if (op === "and") {
            result = { kind: "and", left: result, right: preds[i] } as AndPred;
        } else {
            result = { kind: "or", left: result, right: preds[i] } as OrPred;
        }
    }
    return result;
}

// Вспомогательная функция для конвертации Predicate в Condition
function predicateToCondition(pred: Predicate): Condition {
    switch (pred.kind) {
        case "true":
            return { kind: "true" } as TrueCond;
        case "false":
            return { kind: "false" } as FalseCond;
        case "comparison":
            return pred as ComparisonCond;
        case "not":
            return {
                kind: "not",
                condition: predicateToCondition((pred as NotPred).predicate),
            } as NotCond;
        case "and":
            const andPred = pred as AndPred;
            return {
                kind: "and",
                left: predicateToCondition(andPred.left),
                right: predicateToCondition(andPred.right),
            } as AndCond;
        case "or":
            const orPred = pred as OrPred;
            return {
                kind: "or",
                left: predicateToCondition(orPred.left),
                right: predicateToCondition(orPred.right),
            } as OrCond;
        case "implies":
            const implPred = pred as ImpliesPred;
            return {
                kind: "implies",
                left: predicateToCondition(implPred.left),
                right: predicateToCondition(implPred.right),
            } as ImpliesCond;
        case "paren":
            return {
                kind: "paren",
                inner: predicateToCondition((pred as ParenPred).inner),
            } as ParenCond;
        case "quantifier":
            throw new Error("Кванторы не поддерживаются на уровне C");
        case "formula":
            throw new Error("Ссылки на формулы не поддерживаются в данной реализации");
        default:
            throw new Error(`Неподдерживаемый тип предиката: ${(pred as any).kind}`);
    }
}

function wpStatement(stmt: Statement, post: Condition): Condition {
    switch (stmt.type) {
        case "assign":
            return wpAssign(stmt as AssignSt, post);
        case "block":
            return wpBlock(stmt as BlockSt, post);
        case "if":
            return wpIf(stmt as ConditionalSt, post);
        case "while":
            throw new Error("Не поддерживается: циклы while не верифицируются в этой реализации.");
        case "funccallstmt":
            throw new Error("Не поддерживается: вызовы функций в операторах не верифицируются.");
        default:
            throw new Error(`Неподдерживаемый оператор: ${(stmt as any).type}`);
    }
}

function wpAssign(assign: AssignSt, post: Condition): Condition {
    // Поддерживается только одно присваивание в данной реализации
    if (assign.targets.length !== 1 || assign.exprs.length !== 1) {
        throw new Error("Множественные присваивания не поддерживаются.");
    }

    const target = assign.targets[0];
    const rhs = assign.exprs[0];

    if (target.type === "lvar") {
        // WP для присваивания переменной: подстановка rhs вместо target в post
        return substCond(post, target.name, rhs);
    } else {
        // Присваивание элементу массива не поддерживается
        throw new Error("Присваивание элементам массива не поддерживается.");
    }
}

function wpBlock(block: BlockSt, post: Condition): Condition {
    let current = post;

    // Вычисляем WP с конца блока к началу
    for (let i = block.stmts.length - 1; i >= 0; i--) {
        current = wpStatement(block.stmts[i], current);
    }

    return current;
}

function wpIf(ifStmt: ConditionalSt, post: Condition): Condition {
    const condition = ifStmt.condition;
    const thenWP = wpStatement(ifStmt.then, post);
    const elseWP = ifStmt.else ? wpStatement(ifStmt.else, post) : post;

    // (condition -> thenWP) AND (!condition -> elseWP)
    return and(
        or(not(condition), thenWP),
        or(condition, elseWP)
    );
}

function substCond(cond: Condition, name: string, replacement: Expr): Condition {
    switch (cond.kind) {
        case "true":
        case "false":
            return cond;
        case "comparison":
            const cmp = cond as ComparisonCond;
            return {
                kind: "comparison",
                left: substExpr(cmp.left, name, replacement),
                op: cmp.op,
                right: substExpr(cmp.right, name, replacement),
            } as ComparisonCond;
        case "not":
            return {
                kind: "not",
                condition: substCond((cond as NotCond).condition, name, replacement),
            } as NotCond;
        case "and":
            const andCond = cond as AndCond;
            return {
                kind: "and",
                left: substCond(andCond.left, name, replacement),
                right: substCond(andCond.right, name, replacement),
            } as AndCond;
        case "or":
            const orCond = cond as OrCond;
            return {
                kind: "or",
                left: substCond(orCond.left, name, replacement),
                right: substCond(orCond.right, name, replacement),
            } as OrCond;
        case "implies":
            const implCond = cond as ImpliesCond;
            return {
                kind: "implies",
                left: substCond(implCond.left, name, replacement),
                right: substCond(implCond.right, name, replacement),
            } as ImpliesCond;
        case "paren":
            return {
                kind: "paren",
                inner: substCond((cond as ParenCond).inner, name, replacement),
            } as ParenCond;
        default:
            throw new Error(`Неподдерживаемый тип условия`);
    }
}

function substExpr(expr: Expr, name: string, replacement: Expr): Expr {
    // Проверяем, является ли expr AST выражением из lab04
    const astExpr = expr as ast.Expr;
    if (astExpr.type === 'variable' && astExpr.value === name) {
        return replacement;
    }

    // Обрабатываем арифметические операции из AST
    switch (astExpr.type) {
        case 'number':
            return expr;
        case 'variable':
            // Уже обработали выше
            return expr;
        case 'add_op':
        case 'sub_op':
        case 'mul_op':
        case 'div_op':
            const binExpr = astExpr as ast.BinExpr;
            return {
                ...binExpr,
                left_arg: substExpr(binExpr.left_arg, name, replacement),
                right_arg: substExpr(binExpr.right_arg, name, replacement),
            } as ast.BinExpr;
        case 'unary_min':
            const unExpr = astExpr as ast.NegExpr;
            return {
                ...unExpr,
                arg: substExpr(unExpr.arg, name, replacement),
            } as ast.NegExpr;
        default:
            // Проверяем, является ли expr выражением из funny.ts
            const funnyExpr = expr as any;
            if (funnyExpr.type === "funccall") {
                throw new Error("Не поддерживается: вызовы функций внутри выражений не верифицируются.");
            }
            if (funnyExpr.type === "arraccess") {
                // Не подставляем имена массивов
                return expr;
            }
            throw new Error(`Неподдерживаемый тип выражения: ${(expr as any).type}`);
    }
}


function buildIntEnvironment(Z: Context<'main'>, f: AnnotatedFunctionDef): Map<string, Arith> {
    const env = new Map<string, Arith>();

    // Параметры
    for (const p of f.parameters) {
        env.set(p.name, Z.Int.const(p.name));
    }

    // Возвращаемые значения
    for (const r of f.returns) {
        env.set(r.name, Z.Int.const(r.name));
    }

    // Локальные переменные
    for (const l of f.locals) {
        env.set(l.name, Z.Int.const(l.name));
    }

    return env;
}

function condToZ3(Z: Context<'main'>, cond: Condition, env: Map<string, Arith>): Bool {
    switch (cond.kind) {
        case "true":
            return Z.Bool.val(true);
        case "false":
            return Z.Bool.val(false);
        case "comparison": {
            const cmp = cond as ComparisonCond;
            const left = exprToZ3(Z, cmp.left, env);
            const right = exprToZ3(Z, cmp.right, env);

            switch (cmp.op) {
                case "==": return left.eq(right);
                case "!=": return left.neq(right);
                case ">": return (left as any).gt(right);
                case "<": return (left as any).lt(right);
                case ">=": return (left as any).ge(right);
                case "<=": return (left as any).le(right);
                default: throw new Error(`Неизвестная операция сравнения: ${cmp.op}`);
            }
        }
        case "not":
            return Z.Not(condToZ3(Z, (cond as NotCond).condition, env));
        case "and":
            const andCond = cond as AndCond;
            return Z.And(
                condToZ3(Z, andCond.left, env),
                condToZ3(Z, andCond.right, env)
            );
        case "or":
            const orCond = cond as OrCond;
            return Z.Or(
                condToZ3(Z, orCond.left, env),
                condToZ3(Z, orCond.right, env)
            );
        case "implies":
            const implCond = cond as ImpliesCond;
            return Z.Implies(
                condToZ3(Z, implCond.left, env),
                condToZ3(Z, implCond.right, env)
            );
        case "paren":
            return condToZ3(Z, (cond as ParenCond).inner, env);
        default:
            throw new Error(`Неподдерживаемый тип условия`);
    }
}

function exprToZ3(Z: Context<'main'>, expr: Expr, env: Map<string, Arith>): Arith {
    // Пытаемся обработать как AST выражение
    const astExpr = expr as ast.Expr;

    switch (astExpr.type) {
        case "number":
            return Z.Int.val((astExpr as ast.Num).value);
        case "variable":
            const varName = (astExpr as ast.Variable).value;
            const v = env.get(varName);
            if (!v) throw new Error(`Неизвестная переменная в VC: ${varName}`);
            return v;
        case "add_op":
            const addExpr = astExpr as ast.AddExpr;
            return (exprToZ3(Z, addExpr.left_arg, env) as any).add(exprToZ3(Z, addExpr.right_arg, env));
        case "sub_op":
            const subExpr = astExpr as ast.SubExpr;
            return (exprToZ3(Z, subExpr.left_arg, env) as any).sub(exprToZ3(Z, subExpr.right_arg, env));
        case "mul_op":
            const mulExpr = astExpr as ast.MulExpr;
            return (exprToZ3(Z, mulExpr.left_arg, env) as any).mul(exprToZ3(Z, mulExpr.right_arg, env));
        case "div_op":
            const divExpr = astExpr as ast.DivExpr;
            return (exprToZ3(Z, divExpr.left_arg, env) as any).div(exprToZ3(Z, divExpr.right_arg, env));
        case "unary_min":
            const negExpr = astExpr as ast.NegExpr;
            return (exprToZ3(Z, negExpr.arg, env) as any).neg();
        default:
            // Пытаемся обработать как выражение из funny.ts
            const funnyExpr = expr as any;
            if (funnyExpr.type === "arraccess") {
                // Пока что обрабатываем доступ к массиву как свежую переменную
                const arrExpr = expr as ArrAccessExpr;
                return Z.Int.const(`array_${arrExpr.name}_${JSON.stringify(arrExpr.index)}`);
            }
            if (funnyExpr.type === "funccall") {
                throw new Error("Не поддерживается: вызовы функций внутри выражений не верифицируются.");
            }
            throw new Error(`Неподдерживаемый тип выражения: ${(expr as any).type}`);
    }
}

/* =========================
 *  Конструкторы условий
 * ========================= */

function not(c: Condition): Condition {
    if (c.kind === "true") {
        return { kind: "false" } as FalseCond;
    }
    if (c.kind === "false") {
        return { kind: "true" } as TrueCond;
    }
    return { kind: "not", condition: c } as NotCond;
}

function and(a: Condition, b: Condition): Condition {
    if (a.kind === "false" || b.kind === "false") {
        return { kind: "false" } as FalseCond;
    }
    if (a.kind === "true") {
        return b;
    }
    if (b.kind === "true") {
        return a;
    }
    return { kind: "and", left: a, right: b } as AndCond;
}

function or(a: Condition, b: Condition): Condition {
    if (a.kind === "true" || b.kind === "true") {
        return { kind: "true" } as TrueCond;
    }
    if (a.kind === "false") {
        return b;
    }
    if (b.kind === "false") {
        return a;
    }
    return { kind: "or", left: a, right: b } as OrCond;
}

function implies(a: Condition, b: Condition): Condition {
    // a -> b == !a OR b
    return or(not(a), b);
}