import { MatchResult } from 'ohm-js';
import { arithGrammar, ArithmeticActionDict, ArithmeticSemantics, SyntaxError } from '../../lab03';
import { AddExpr, BracExpr, Expr, MulExpr, NegExpr, Num, Variable } from './ast';

export const getExprAst: ArithmeticActionDict<Expr> = {
    Expr(expr) {
        const ast_expr : Expr = expr.parse();
        return ast_expr;
    },

    AddExpr(expr, it1, it2) {
        const add_expr : AddExpr = {type: 'add_op', ops: [], args: []};
        add_expr.args.push(expr.parse());

        const ops = it1.children;
        const args = it2.children;

        for (let i = 0; i < ops.length; i++) {
            if (ops[i].sourceString == "+") {
                add_expr.ops.push("+");
            } else if (ops[i].sourceString == "-") {
                add_expr.ops.push("-");
            } else {
                throw Error;
            }
            add_expr.args.push(args[i].parse());
        }
        return add_expr;
    },

    MulExpr(expr, it1, it2) {
        const mul_expr : MulExpr = {type: 'mul_op', ops: [], args: []};
        mul_expr.args.push(expr.parse());

        const ops = it1.children;
        const args = it2.children;

        for (let i = 0; i < ops.length; i++) {
            if (ops[i].sourceString == "*") {
                mul_expr.ops.push("*");
            } else if (ops[i].sourceString == "/") {
                mul_expr.ops.push("/");
            } else {
                throw Error;
            }
            mul_expr.args.push(args[i].parse());
        }
        return mul_expr;
    },

    AtomExpr(expr) {
        return expr.parse();
    },

    NegExpr(_, expr) {
        const neg_expr : NegExpr = {type: 'unary_min', arg: expr.parse()}
        return neg_expr;
    },

    BracExpr(_, expr, __) {
        const brac_expr : BracExpr = {type: 'brac_expr', arg: expr.parse()}
        return brac_expr;
    },

    variable(_, __) {
        const variable : Variable = {type: 'variable', value: this.sourceString};
        return variable;
    },

    num(_) {
        const num : Num = {type: 'number', value: parseInt(this.sourceString)};
        return num;
    }
    // write rules here
}

export const semantics = arithGrammar.createSemantics();
semantics.addOperation("parse()", getExprAst);

export interface ArithSemanticsExt extends ArithmeticSemantics
{
    (match: MatchResult): ArithActionsExt
}

export interface ArithActionsExt 
{
    parse(): Expr
}
export function parseExpr(source: string): Expr
{
    const match : MatchResult = arithGrammar.match(source);
    if (match.failed())  {
        throw new SyntaxError(match.message);
    }
    return semantics(match).parse();
}


    
