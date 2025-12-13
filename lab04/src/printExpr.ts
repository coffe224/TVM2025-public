import { Expr } from "./ast";

export function printExpr(e: Expr, parent_type?: Expr['type'], is_right_arg?: boolean):string
{
    let result : string = "";
    switch (e.type) {
        case 'mul_op':
        case 'add_op':
        case 'div_op':
        case 'sub_op':
            result = `${printExpr(e.left_arg, e.type, false)} ${e.op} ${printExpr(e.right_arg, e.type, true)}`;
            break;
            
        case 'unary_min':
            result = `-${printExpr(e.arg, e.type)}`;
            break;
            
        case 'variable':
            result = e.value;
            break;
            
        case 'number':
            result = e.value.toString();
            break;
    }

    if (isParenthesisNeeded(e.type, parent_type, is_right_arg)) {
        return `(${result})`;
    }
    return result;
}

function isParenthesisNeeded(type: Expr['type'], parent_type?: Expr['type'], is_right_arg?: boolean): boolean {
    switch (type) {
        case 'variable':
        case 'number':
        case 'unary_min':
            return false;

        case 'add_op':
        case 'mul_op':
        case 'div_op':
        case 'sub_op':
            if (!parent_type) {
                return false;
            }

            const precedence = getPrecedence(type);
            const parent_precedence = getPrecedence(parent_type);
            
            if (parent_precedence > precedence) {
                return true;
            }

            if (parent_precedence < precedence) {
                return false
            }

            if (parent_type == 'sub_op' && is_right_arg) {
                return true;
            } 

            if (parent_type == 'div_op' && is_right_arg) {
                return true;
            }

            return false;
    }
}

function getPrecedence(type: Expr['type']): number {
    switch (type) {
        case 'unary_min':
            return 3;
        case 'mul_op':
        case 'div_op':
            return 2;
        case 'add_op':
        case 'sub_op':
            return 1;
        case 'variable':
        case 'number':
            return 0;
    }
}