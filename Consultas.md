-- Coordinadores / Gerentes

select
	*
from
	pdv.catcomisionistas c
where
	c.FechaTerm = ""
	
select idCategoria, Nombre from pdv.borrar_catcategcomisionistas bc 
	
0	Vendedor Retail
1	Encargado de sucursal
2	Coordinador
3	Gerente Regional
4	Extra Tienda
5	Segundo Encargado
6	Vendedor Volante
7	Vendedor en capacitacion
8	Vendedor Exclusivo VDT
9	B2B


-- sucursales
select
	s.Num_suc, s.Nombre, s2.idSubZona IdRegion, s2.nombre Region
from
	comun.sucursal s
left join comun.subzonas s2 on
	s.idSubZona = s2.idSubZona
left join estapinta.analisisventasxdia a on
	s.Num_suc = a.Sucursal
where
	s.SubTipoSuc in ("2", "S")
	and a.Fecha >= CONCAT(YEAR(curdate()),'0101')
group by
	s.Num_suc, s.Nombre, s2.idSubZona, s2.nombre
having 
	count(a.Sucursal) > 0
	
-- objetivos
SELECT
    a.Mes,
    s.Num_suc,
    ObjNetas,
    d.Base_Dinamica_Final AS diasmes,
    d.Dias_Efectivos_Pasado AS DiasTranscurridos,
    d.Base_Dinamica_Final AS DiasLaborales,
    -- Objetivo Diario: Evita división por cero en días del mes
    ObjNetas / NULLIF(d.Base_Dinamica_Final, 0) AS Objdiario,
    -- Objetivo Proporcional: Limpiamos la lógica con COALESCE y NULLIF
    (ObjNetas / NULLIF(d.Base_Dinamica_Final, 0)) * IFNULL(d.Dias_Efectivos_Pasado, 0) AS ObjProporcional,
    -- Objetivo Tickets Proporcional
    (ObjNT / NULLIF(d.Base_Dinamica_Final, 0)) * IFNULL(d.Dias_Efectivos_Pasado, 0) AS ObjTicketsProporcional,
    ObjTP,
    ObjNT,
    ObjAxT,
    Ventanetasucursal,
    AxtSucursal,
    tpSucursal,
    ticketssucursal,
    renglonessucursal,
    CONCAT(a.mes, s.nombre) AS ID,
    CONCAT(a.mes, '01') AS Fecha,  

    
    -- Cumplimiento: Usamos NULLIF en el denominador para evitar errores
    Ventanetasucursal / NULLIF((ObjNetas / NULLIF(d.Base_Dinamica_Final, 0)) * IFNULL(d.Dias_Efectivos_Pasado, 0), 0) AS Cumplimiento
FROM
    estapinta.ComisXVtasSuc AS a
LEFT JOIN
    comun.sucursal AS s ON s.num_suc = a.sucursal
LEFT JOIN 
    estapinta.dias_laborables AS d ON d.num_suc = a.sucursal AND d.mes = a.mes
WHERE
    a.Mes >= '202601'
    AND ObjNetas > 0
    AND SubTipoSuc IN ('S', '2', 'V');