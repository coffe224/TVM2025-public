import { Expr } from "../../lab04";

export function derive(e: Expr, varName: string): Expr
{
    console.log("Entered the derive function with type: " + e.type);

    switch(e.type) {
        case 'add_op':
        {
            const new_expr : Expr = {
                type: 'add_op', 
                left_arg: derive(e.left_arg, varName), 
                right_arg: derive(e.right_arg, varName)};
            return simplify(new_expr);
        }

        case 'sub_op':
        {
            const new_expr : Expr = {
                type: 'sub_op', 
                left_arg: derive(e.left_arg, varName), 
                right_arg: derive(e.right_arg, varName)};
            return simplify(new_expr);
        }

        case 'mul_op':
        {
            const f_expr : Expr = e.left_arg;
            const f_deriv_expr : Expr = derive(f_expr, varName);


            const g_expr : Expr = e.right_arg;
            const g_deriv_expr : Expr = derive(g_expr, varName);

            const f_deriv_times_g : Expr = {
                type: 'mul_op',
                left_arg: f_deriv_expr,
                right_arg: g_expr};

            const f_times_g_deriv : Expr = {
                type: 'mul_op',
                left_arg: f_expr,
                right_arg: g_deriv_expr};
            
            const new_expr : Expr = {
                type: 'add_op', 
                left_arg: simplify(f_deriv_times_g), 
                right_arg: simplify(f_times_g_deriv)};
            return simplify(simplify(new_expr));
        }

        case 'div_op':
        {
            const f_expr : Expr = e.left_arg;
            const f_deriv_expr : Expr = derive(f_expr, varName);


            const g_expr : Expr = e.right_arg;
            const g_deriv_expr : Expr = derive(g_expr, varName);

            const f_deriv_times_g : Expr = {
                type: 'mul_op',
                left_arg: f_deriv_expr,
                right_arg: g_expr};

            const f_times_g_deriv : Expr = {
                type: 'mul_op',
                left_arg: f_expr,
                right_arg: g_deriv_expr};
            
            const numerator : Expr = {
                type: 'sub_op', 
                left_arg: simplify(f_deriv_times_g), 
                right_arg: simplify(f_times_g_deriv)};

            const denominator : Expr = {
                type: 'mul_op',
                left_arg: g_expr,
                right_arg: g_expr};

            const new_expr : Expr = {
                type: 'div_op', 
                left_arg: simplify(numerator), 
                right_arg: simplify(denominator)};

            return simplify(new_expr);
        }

        case 'variable':
        {
            console.log("Varname: " + varName + " | Variable: " + e.value);
            const new_expr : Expr = {type: 'number', value: 0}
            if (e.value == varName) {
                console.log(e.value);
                new_expr.value = 1;
            }
            return simplify(new_expr);
        }

        case 'unary_min':
        {
            const new_expr : Expr = {type: 'unary_min', arg: derive(e.arg, varName)};
            return simplify(new_expr);
        }

        case 'number':
        {
            console.log("Number: " + e.value);
            const new_expr : Expr = {type: 'number', value: 0}
            return simplify(new_expr);
        }


    }
}


function isZero(e: Expr): boolean { 
    return e.type == "number" && e.value == 0;
}

function isOne(e: Expr): boolean  {
    return e.type == "number" && e.value == 1;
}

export function simplify(e: Expr): Expr {
    // x * 0 = 0 * x = 0
    if (e.type == 'mul_op' && (isZero(e.left_arg) || isZero(e.right_arg))) {
        e = {type: 'number', value: 0};
    }

    // 1 * x = x
    if (e.type == 'mul_op' && isOne(e.left_arg)) {
        e = e.right_arg;
    }

    // x * 1 = x
    if (e.type == 'mul_op' && isOne(e.right_arg)) {
        e = e.left_arg;
    }

    // x / 1 = x
    if (e.type == 'div_op' && isOne(e.right_arg)) {
        e = e.left_arg;
    }

    // x + 0 = x
    if (e.type == 'add_op' && isZero(e.right_arg)) {
        e = e.left_arg;
    }

    // 0 + x = x
    if (e.type == 'add_op' && isZero(e.left_arg)) {
        e = e.right_arg;
    }

    // x - 0 = x
    if (e.type == 'sub_op' && isZero(e.right_arg)) {
        e = e.left_arg;
    }

    // 0 - x = -x
    if (e.type == 'sub_op' && isZero(e.left_arg)) {
        e = {type: 'unary_min', arg: e.right_arg};
    }

    // -0 = 0
    if (e.type == 'unary_min' && isZero(e.arg)) {
        e = e.arg;
    }

    // (-x/y) = -(x/y) etc
    if (e.type == 'div_op' || e.type == 'mul_op') {
        const left_arg = e.left_arg;
        const right_arg = e.right_arg;
        if (left_arg.type == 'unary_min' && right_arg.type == 'unary_min') {
            e = {type: e.type, left_arg: left_arg.arg, right_arg: right_arg.arg};
        } else if (left_arg.type == 'unary_min') {
            const new_expr = {type: e.type, left_arg: left_arg.arg, right_arg: e.right_arg};
            e = {type: 'unary_min', arg: new_expr};
        } else if (right_arg.type == 'unary_min') {
            const new_expr = {type: e.type, left_arg: e.left_arg, right_arg: right_arg.arg};
            e = {type: 'unary_min', arg: new_expr};
        }
    }

    // --x = x
    while (e.type == 'unary_min' && e.arg.type == 'unary_min') {
        e = e.arg.arg;
    }

    return e;
}