package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.FieldExtension;

public class FieldExtensionBuilder {
  private String fieldName;
  private String fieldValue = null;

  private String expression = null;

  public FieldExtensionBuilder fieldName(String fieldName) {
    this.fieldName = fieldName;
    return this;
  }

  public FieldExtensionBuilder fieldValue(String fieldValue) {
    this.fieldValue = fieldValue;
    return this;
  }

  public FieldExtensionBuilder expression(String expression) {
    this.expression = expression;
    return this;
  }

  public FieldExtension build() {
    FieldExtension fieldExtension = new FieldExtension();
    fieldExtension.setFieldName(fieldName);
    if (fieldValue != null) {
      fieldExtension.setStringValue(fieldValue);
    } else if (expression != null) {
      fieldExtension.setExpression(expression);
    } else {
      throw new RuntimeException(
          "FieldExtension must have either a 'fieldValue' or an  'expression'");
    }
    return fieldExtension;
  }
}
