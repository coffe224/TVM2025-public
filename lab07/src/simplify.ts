import { Expr } from "../../lab04";
import { cost } from "./cost";

function exprEquals(a: Expr, b: Expr): boolean {
    switch (a.type) {
        case 'add_op':
        case 'sub_op':
        case 'mul_op':
        case 'div_op':
            if (b.type !== a.type) return false;
            return exprEquals(a.left_arg, b.left_arg) && exprEquals(a.right_arg, b.right_arg);
        
        case 'unary_min':
            if (b.type !== 'unary_min') return false;
            return exprEquals(a.arg, b.arg);
        
        case 'variable':
            if (b.type !== 'variable') return false;
            return a.value === b.value;
        
        case 'number':
            if (b.type !== 'number') return false;
            return a.value === b.value;
    }
}

function copyExpr(e: Expr): Expr {
    switch (e.type) {
        case 'number':
            return { type: 'number', value: e.value };
        case 'variable':
            return { type: 'variable', value: e.value };
        case 'unary_min':
            return { type: 'unary_min', arg: copyExpr(e.arg) };
        case 'add_op':
        case 'sub_op':
        case 'mul_op':
        case 'div_op':
            return { type: e.type, left_arg: copyExpr(e.left_arg), right_arg: copyExpr(e.right_arg) };
    }
}

function substitute(expr: Expr, pattern: Expr, replacement: Expr): Expr | null {
    // Check if expr matches the pattern
    if (exprEquals(expr, pattern)) {
        return copyExpr(replacement);
    }
    
    // Recursively substitute in sub-expressions
    switch (expr.type) {
        case 'number':
        case 'variable':
            return null; // No substitution occurred
        
        case 'unary_min':
            const newArg = substitute(expr.arg, pattern, replacement);
            if (newArg !== null) {
                return { type: 'unary_min', arg: newArg };
            }
            break;
        
        case 'add_op':
        case 'sub_op':
        case 'mul_op':
        case 'div_op':
            const newLeft = substitute(expr.left_arg, pattern, replacement);
            const newRight = substitute(expr.right_arg, pattern, replacement);
            
            if (newLeft !== null || newRight !== null) {
                return {
                    type: expr.type,
                    left_arg: newLeft !== null ? newLeft : copyExpr(expr.left_arg),
                    right_arg: newRight !== null ? newRight : copyExpr(expr.right_arg)
                };
            }
            break;
    }
    
    return null;
}


export function simplify(expr: Expr, identities: [Expr, Expr][]): Expr {
    // We need to consider all possible orders of applying identities
    // This is essentially a search problem
    
    // Start with a simple approach: try all identities in order, then recursively simplify
    let bestExpr = copyExpr(expr);
    let bestCost = cost(bestExpr);
    
    // Try each identity as the first step
    for (const [pattern, replacement] of identities) {
        const newExpr = substitute(expr, pattern, replacement);
        
        if (newExpr !== null) {
            // Recursively simplify the result
            const simplifiedExpr = simplify(newExpr, identities);
            const newCost = cost(simplifiedExpr);
            
            if (newCost < bestCost) {
                bestExpr = simplifiedExpr;
                bestCost = newCost;
            }
        }
    }
    
    // Also try simplifying sub-expressions first
    switch (expr.type) {
        case 'unary_min':
            const simplifiedArg = simplify(expr.arg, identities);
            const argCost = cost(simplifiedArg);
            if (argCost < bestCost) {
                bestExpr = { type: 'unary_min', arg: simplifiedArg };
                bestCost = argCost;
            }
            break;
            
        case 'add_op':
        case 'sub_op':
        case 'mul_op':
        case 'div_op':
            const simplifiedLeft = simplify(expr.left_arg, identities);
            const simplifiedRight = simplify(expr.right_arg, identities);
            const childrenCost = cost(simplifiedLeft) + cost(simplifiedRight);
            
            if (childrenCost + 1 < bestCost) {
                bestExpr = {
                    type: expr.type,
                    left_arg: simplifiedLeft,
                    right_arg: simplifiedRight
                };
                bestCost = childrenCost + 1;
            }
            break;
    }
    
    return bestExpr;
}