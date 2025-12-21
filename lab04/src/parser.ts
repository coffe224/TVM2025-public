import { MatchResult } from 'ohm-js';
import { arithGrammar, ArithmeticActionDict, ArithmeticSemantics, SyntaxError } from '../../lab03';
import { AddExpr, Expr, MulExpr, NegExpr, Num, Variable } from './ast';

export const getExprAst: ArithmeticActionDict<Expr> = {
    Expr(expr) {
        const ast_expr : Expr = expr.parse();
        return ast_expr;
    },

    AddExpr(expr, it1, it2) {
        const ops = it1.children;
        const args = it2.children;

        let cur_expr : Expr = expr.parse();

        for (let i = 0; i < ops.length; i++) {
            const right_expr : Expr = args[i].parse();
            if (ops[i].sourceString == "+") {
                cur_expr = {
                    type: 'add_op', 
                    left_arg: cur_expr, 
                    right_arg: right_expr}
            } else if (ops[i].sourceString == "-") {
                cur_expr = {
                    type: 'sub_op',
                    left_arg: cur_expr, 
                    right_arg: right_expr}
            } else {
                throw Error;
            }
        }
        return cur_expr;
    },

    MulExpr(expr, it1, it2) {
        const ops = it1.children;
        const args = it2.children;

        let cur_expr : Expr = expr.parse();

        for (let i = 0; i < ops.length; i++) {
            const right_expr : Expr = args[i].parse();
            if (ops[i].sourceString == "*") {
                cur_expr = {
                    type: 'mul_op', 
                    left_arg: cur_expr, 
                    right_arg: right_expr}
            } else if (ops[i].sourceString == "/") {
                cur_expr = {
                    type: 'div_op', 
                    left_arg: cur_expr, 
                    right_arg: right_expr}
            } else {
                throw Error;
            }
        }
        return cur_expr;
    },

    AtomExpr(expr) {
        return expr.parse();
    },

    NegExpr(_, expr) {
        const neg_expr : NegExpr = {type: 'unary_min', arg: expr.parse()}
        return neg_expr;
    },

    BracExpr(_, expr, __) {
        return expr.parse();
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


    
