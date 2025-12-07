import { Expr } from "./ast";



export function printExpr(e: Expr):string
{
    switch (e.type) {
        case 'add_op':
            let addResult = printExpr(e.args[0]);
            for (let i = 1; i < e.args.length; i++) {
                addResult += ` ${e.ops[i - 1]} ${printExpr(e.args[i])}`;
            }
            return addResult;
            
        case 'mul_op':
            let mulResult = printExpr(e.args[0]);
            for (let i = 1; i < e.args.length; i++) {
                mulResult += ` ${e.ops[i - 1]} ${printExpr(e.args[i])}`;
            }
            return mulResult;
            
        case 'unary_min':
            return `-${printExpr(e.arg)}`;
            
        case 'brac_expr':
            return `(${printExpr(e.arg)})`;
            
        case 'variable':
            return e.value;
            
        case 'number':
            return e.value.toString();
    }
}
